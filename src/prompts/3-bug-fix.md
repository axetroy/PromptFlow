---
title: Bug Fix
description: Debug and fix code issues
tags:
  - dev
  - debug
  - fix
---

Act as a Staff Software Engineer specializing in debugging complex production issues.

Analyze the code in the **PROMPT_INPUT** block below:

<PROMPT_INPUT>
<VAR name="code" description="The source code with issues">{code}</VAR>
</PROMPT_INPUT>

Reported error in the **PROMPT_INPUT** block below:

<PROMPT_INPUT>
<VAR name="error" description="The error message to be analyzed" defaultValue="None">{error}</VAR>
</PROMPT_INPUT>

Your goal is to identify the root cause instead of only fixing the symptom.

Your response must be returned in the following strict Markdown format. Do not add any extra sections, commentary, or explanatory text outside this structure.

---

## Error Analysis

- Explain what the error means.
- Explain when this error typically occurs.

## Root Cause Analysis

Identify all plausible causes.

For each cause provide:

- Likelihood (Critical / High / Medium / Low)
- Supporting evidence from the code
- Why it would produce the reported error
- Confidence level

## Most Likely Root Cause

Explain why this is the best explanation.

## Fix

Provide:

- Minimal fix
- Recommended production-quality fix
- Updated code

## Validation

Explain how to verify the fix.

Include:

- Manual verification steps
- Unit tests to add
- Edge cases to test

## Prevention

Recommend improvements to:

- Code quality
- Error handling
- Logging
- Testing
- Architecture

Important rules:

- Never invent information that is not present.
- Distinguish facts from assumptions.
- If multiple explanations exist, rank them by probability.
- If the issue cannot be determined conclusively, specify exactly what additional information is required.