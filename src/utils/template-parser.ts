/**
 * Template Variables Parser
 * 
 * Supports syntax:
 * - {variable_name} - Required variable
 * - {variable_name:default_value} - Variable with default value
 * 
 * Examples:
 * - {tone} -> User must provide value
 * - {tone:professional} -> Uses "professional" if no value provided
 * - {topic} -> User must provide value
 */

export interface Variable {
  name: string;
  defaultValue?: string;
  startIndex: number;
  endIndex: number;
  fullMatch: string;
}

export interface ParseResult {
  variables: Variable[];
  template: string;
}

/**
 * Regular expression to match template variables
 * Matches: {variable_name} or {variable_name:default_value}
 * 
 * - Supports alphanumeric, underscore, hyphen in variable names
 * - Default values can contain any character except }
 */
const VARIABLE_PATTERN = /\{([a-zA-Z_][a-zA-Z0-9_-]*)(?::([^}]*))?\}/g;

/**
 * Parse template string and extract all variables
 */
export function parseTemplate(template: string): ParseResult {
  const variables: Variable[] = [];
  const seen = new Map<string, number>(); // Track duplicate variable names
  
  let match;
  while ((match = VARIABLE_PATTERN.exec(template)) !== null) {
    const name = match[1];
    const defaultValue = match[2] || undefined;
    
    // Track occurrences for duplicate naming
    const occurrence = seen.get(name) || 0;
    seen.set(name, occurrence + 1);
    
    variables.push({
      name,
      defaultValue,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      fullMatch: match[0],
    });
  }
  
  // Reset regex lastIndex for future use
  VARIABLE_PATTERN.lastIndex = 0;
  
  return {
    variables,
    template,
  };
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
 * @param template - The template string with {variable} placeholders
 * @param values - Object mapping variable names to values
 * @returns Interpolated string with values replaced
 */
export function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(VARIABLE_PATTERN, (match, name, defaultValue) => {
    const value = values[name];
    
    if (value !== undefined && value !== '') {
      return value;
    }
    
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    
    // Return original if no value provided and no default
    return match;
  });
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