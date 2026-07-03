---
title: Code Review
description: Review code and provide improvement suggestions
tags:
  - dev
  - review
  - code
---

Act as a Staff Software Engineer conducting a production-ready code review.

Review the code in the **PROMPT_INPUT** block below:

<PROMPT_INPUT>
<VAR name="code" description="The source code to be reviewed">{code}</VAR>
</PROMPT_INPUT>

Your review must be returned in the following strict Markdown format. Do not add any extra sections, commentary, or explanatory text outside this structure.

---

## 📋 Executive Summary

Briefly summarize the overall state of the code, key strengths, and the most critical risks (if any) in 3–5 sentences.

---

## 🔍 Findings

For each issue identified, use the following template. Sort findings by severity (Critical → High → Medium → Low).

### [Severity: Critical/High/Medium/Low] – [Short Issue Title]

- **Location**: `file_path:line_number` (if known, otherwise describe where)
- **Explanation**: Clear description of the problem.
- **Why It Matters**: Impact on system behavior, security, performance, or maintainability.
- **Recommended Fix**: Actionable solution.
- **Improved Code Example** (if applicable):
  ```language
  // Your improved code snippet here
  ```

---

## 📊 Scores

Provide numerical scores with a brief justification for each.

| Metric | Score (0–10) | Justification |
|--------|--------------|---------------|
| Quality | [0–10] | One-sentence rationale |
| Maintainability | [0–10] | One-sentence rationale |
| Production Readiness | [0–10] | One-sentence rationale |

---

## 🚀 Top 3 Impact Improvements

List the three changes that would deliver the highest overall benefit.

1. **Improvement 1** – Brief description and expected outcome.
2. **Improvement 2** – Brief description and expected outcome.
3. **Improvement 3** – Brief description and expected outcome.

---

If no issues are found, output only the following:

---

## ✅ No Issues Found

The code is production-ready. Optional optimizations may include:

- [Suggestion 1]
- [Suggestion 2]
- [Suggestion 3]

---

## 📊 Scores

| Metric | Score (0–10) | Justification |
|--------|--------------|---------------|
| Quality | [0–10] | One-sentence rationale |
| Maintainability | [0–10] | One-sentence rationale |
| Production Readiness | [0–10] | One-sentence rationale |

---

## 🚀 Top 3 Suggested Optimizations

1. **Optimization 1** – Brief description and expected benefit.
2. **Optimization 2** – Brief description and expected benefit.
3. **Optimization 3** – Brief description and expected benefit.
