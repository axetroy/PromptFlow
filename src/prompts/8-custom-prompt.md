---
title: Custom Prompt Template
description: A template prompt with customizable variables
tags:
  - template
  - example
---

Write a <VAR name="tone" description="语气风格，如 professional、friendly、casual" defaultValue="professional"></VAR> explanation about <VAR name="topic" description="要解释的主题"></VAR>.

The explanation should:
- Be clear and concise
- Include practical examples
- Be approximately <VAR name="length" description="长度：short、medium、long" defaultValue="medium"></VAR> in length

Focus areas: <VAR name="focus_areas" description="重点领域" defaultValue="general concepts"></VAR>

Additional context:
<VAR name="context" description="额外上下文信息" defaultValue="No additional context provided"></VAR>