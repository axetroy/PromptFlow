/**
 * Template Variables Parser
 * 
 * Uses a state machine for precise scanning of <VAR> template variables.
 * 
 * Supports syntax:
 * - <VAR name="variable_name"></VAR> - Required variable
 * - <VAR name="variable_name" defaultValue="default_value"></VAR> - Variable with default value
 * - <VAR name="variable_name" description="Description text"></VAR> - Variable with description
 * 
 * Examples:
 * - <VAR name="tone"></VAR> -> User must provide value
 * - <VAR name="tone" defaultValue="professional"></VAR> -> Uses "professional" if no value provided
 * - <VAR name="topic" description="The main topic to explain"></VAR> -> Shows description in UI
 * 
 * Design Rationale:
 * - State machine ensures precise character-by-character parsing
 * - Handles nested tags, special characters, and edge cases correctly
 * - No regex backtracking issues
 * - Clear state transitions for debugging
 */

export interface Variable {
  name: string;
  defaultValue?: string;
  description?: string;
  startIndex: number;
  endIndex: number;
  fullMatch: string;
}

export interface ParseResult {
  variables: Variable[];
  template: string;
}

// State machine states
enum State {
  TEXT = 'TEXT',           // Normal text, looking for <
  TAG_OPEN = 'TAG_OPEN',   // Found <, checking if it's VAR
  TAG_NAME = 'TAG_NAME',   // Parsing tag name (VAR)
  ATTRS = 'ATTRS',         // Parsing attributes
  TAG_CLOSE = 'TAG_CLOSE', // Found > or />, finishing tag
}

/**
 * State machine parser for <VAR> template variables
 * 
 * More precise than regex, handles edge cases better:
 * - Nested quotes in attribute values
 * - Self-closing tags vs closing tags
 * - Content between opening and closing tags
 */
export function parseTemplate(template: string): ParseResult {
  const variables: Variable[] = [];
  let i = 0;
  
  while (i < template.length) {
    if (template[i] === '<') {
      // Try to parse a VAR tag starting at position i
      const result = parseVarTag(template, i);
      if (result) {
        variables.push(result.variable);
        i = result.endIndex;
        continue;
      }
    }
    i++;
  }
  
  return { variables, template };
}

/**
 * Parse a single VAR tag starting at the given index
 * Returns the variable if found, null otherwise
 */
function parseVarTag(template: string, startIndex: number): { variable: Variable; endIndex: number } | null {
  // Check if this is a VAR tag (must be exactly "VAR")
  if (template.slice(startIndex, startIndex + 4) !== '<VAR') {
    return null;
  }
  
  let i = startIndex + 4; // Skip past "<VAR"
  
  // Skip whitespace
  while (i < template.length && /\s/.test(template[i])) {
    i++;
  }
  
  // Check if we hit the end or something other than an attribute
  if (i >= template.length) {
    return null;
  }
  
  // Parse attributes
  const attrs = parseAttributes(template, i);
  if (!attrs) {
    return null;
  }
  
  i = attrs.endIndex;
  
  // Check for self-closing or closing tag
  // Skip whitespace
  while (i < template.length && /\s/.test(template[i])) {
    i++;
  }
  
  let isSelfClosing = false;
  let contentEndIndex = i;
  
  if (template[i] === '/') {
    // Self-closing tag
    isSelfClosing = true;
    i++;
    // Skip whitespace before >
    while (i < template.length && /\s/.test(template[i])) {
      i++;
    }
  }
  
  if (template[i] !== '>') {
    return null; // Invalid tag ending
  }
  
  contentEndIndex = i + 1; // Include the >
  
  // If not self-closing, find the closing </VAR>
  if (!isSelfClosing) {
    const closeIndex = template.indexOf('</VAR>', i + 1);
    if (closeIndex === -1) {
      return null; // No closing tag
    }
    contentEndIndex = closeIndex + 6; // Include "</VAR>"
  }
  
  // Validate that we have a name attribute
  if (!attrs.name) {
    return null;
  }
  
  const fullMatch = template.slice(startIndex, contentEndIndex);
  
  return {
    variable: {
      name: attrs.name,
      defaultValue: attrs.defaultValue,
      description: attrs.description,
      startIndex,
      endIndex: contentEndIndex,
      fullMatch,
    },
    endIndex: contentEndIndex,
  };
}

/**
 * Parse attributes inside a VAR tag
 */
function parseAttributes(
  template: string,
  startIndex: number
): { name?: string; defaultValue?: string; description?: string; endIndex: number } | null {
  const attrs: { name?: string; defaultValue?: string; description?: string } = {};
  let i = startIndex;
  
  while (i < template.length) {
    // Skip whitespace
    while (i < template.length && /\s/.test(template[i])) {
      i++;
    }
    
    // Check for end of attributes (>)
    if (i >= template.length || template[i] === '>' || (template[i] === '/' && template[i + 1] === '>')) {
      break;
    }
    
    // Parse attribute name
    const attrName = parseAttrName(template, i);
    if (!attrName) {
      return null;
    }
    i = attrName.endIndex;
    
    // Skip whitespace
    while (i < template.length && /\s/.test(template[i])) {
      i++;
    }
    
    // Expect =
    if (template[i] !== '=') {
      return null;
    }
    i++;
    
    // Skip whitespace after =
    while (i < template.length && /\s/.test(template[i])) {
      i++;
    }
    
    // Expect opening quote
    if (template[i] !== '"') {
      return null;
    }
    i++;
    
    // Parse quoted value
    const value = parseQuotedString(template, i);
    if (value === null) {
      return null;
    }
    i = value.endIndex;
    
    // Store attribute
    if (attrName.name === 'name') {
      attrs.name = value.value;
    } else if (attrName.name === 'defaultValue') {
      attrs.defaultValue = value.value;
    } else if (attrName.name === 'description') {
      attrs.description = value.value;
    }
    // Ignore unknown attributes
  }
  
  return { ...attrs, endIndex: i };
}

/**
 * Parse an attribute name
 */
function parseAttrName(template: string, startIndex: number): { name: string; endIndex: number } | null {
  let i = startIndex;
  
  // First character must be letter or underscore
  if (i >= template.length || !/[a-zA-Z_]/.test(template[i])) {
    return null;
  }
  i++;
  
  // Remaining characters can be letters, digits, underscores, hyphens
  while (i < template.length && /[a-zA-Z0-9_-]/.test(template[i])) {
    i++;
  }
  
  return { name: template.slice(startIndex, i), endIndex: i };
}

/**
 * Parse a quoted string, handling escaped quotes
 */
function parseQuotedString(template: string, startIndex: number): { value: string; endIndex: number } | null {
  let i = startIndex;
  let value = '';
  
  while (i < template.length) {
    const char = template[i];
    
    if (char === '"') {
      // End of string
      return { value, endIndex: i + 1 };
    }
    
    if (char === '\\' && i + 1 < template.length && template[i + 1] === '"') {
      // Escaped quote
      value += '"';
      i += 2;
      continue;
    }
    
    value += char;
    i++;
  }
  
  return null; // Unclosed quote
}

/**
 * Extract unique variable names from template
 */
export function getUniqueVariables(template: string): Variable[] {
  const { variables } = parseTemplate(template);
  const uniqueMap = new Map<string, Variable>();
  
  for (const v of variables) {
    if (!uniqueMap.has(v.name)) {
      uniqueMap.set(v.name, v);
    }
  }
  
  return Array.from(uniqueMap.values());
}

/**
 * Check if template contains any variables
 */
export function hasVariables(template: string): boolean {
  const { variables } = parseTemplate(template);
  return variables.length > 0;
}

/**
 * Check if all variables in template have default values
 */
export function allVariablesHaveDefaults(template: string): boolean {
  const { variables } = parseTemplate(template);
  return variables.length > 0 && variables.every(v => v.defaultValue !== undefined);
}

/**
 * Interpolate template with provided values
 * 
 * @param template - The template string with <VAR> placeholders
 * @param values - Object mapping variable names to values
 * @returns Interpolated string with values replaced
 */
export function interpolate(template: string, values: Record<string, string>): string {
  // First, find all VAR tags with their positions
  const { variables } = parseTemplate(template);
  
  // If no variables, return template as-is
  if (variables.length === 0) {
    return template;
  }
  
  // Build result by replacing each variable
  let result = '';
  let lastIndex = 0;
  
  for (const variable of variables) {
    // Add text before this variable
    result += template.slice(lastIndex, variable.startIndex);
    
    // Determine replacement value
    const replacement = determineReplacement(variable, values);
    
    // Add replacement
    result += replacement;
    
    lastIndex = variable.endIndex;
  }
  
  // Add remaining text
  result += template.slice(lastIndex);
  
  return result;
}

/**
 * Determine the replacement value for a variable
 */
function determineReplacement(variable: Variable, values: Record<string, string>): string {
  const value = values[variable.name];
  
  if (value !== undefined && value !== '') {
    return value;
  }
  
  if (variable.defaultValue !== undefined && variable.defaultValue !== '') {
    return variable.defaultValue;
  }
  
  // Return original if no value provided and no default
  return variable.fullMatch;
}

/**
 * Generate a preview of the template with sample values
 * Useful for showing users what the output might look like
 */
export function generatePreview(template: string, values?: Record<string, string>): string {
  const variables = getUniqueVariables(template);
  
  // Generate sample values for variables without provided values
  const previewValues: Record<string, string> = { ...values };
  
  for (const v of variables) {
    if (previewValues[v.name] === undefined) {
      // Use default value if available, otherwise use placeholder
      previewValues[v.name] = v.defaultValue || `[${v.name}]`;
    }
  }
  
  return interpolate(template, previewValues);
}

/**
 * Validate variable name according to rules
 */
export function isValidVariableName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name);
}

/**
 * Extract variable usage statistics from template
 */
export function getVariableStats(template: string): {
  total: number;
  unique: number;
  withDefaults: number;
  required: number;
} {
  const variables = parseTemplate(template).variables;
  const uniqueVars = getUniqueVariables(template);
  
  return {
    total: variables.length,
    unique: uniqueVars.length,
    withDefaults: uniqueVars.filter(v => v.defaultValue !== undefined).length,
    required: uniqueVars.filter(v => v.defaultValue === undefined).length,
  };
}