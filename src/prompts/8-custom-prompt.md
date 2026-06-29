---
title: Custom Prompt Template
description: A template prompt with customizable variables
tags:
  - template
  - example
---

Write a <VAR name="tone" description="The tone style, e.g., professional, friendly, casual" defaultValue="professional"></VAR> explanation about <VAR name="topic" description="The topic to be explained"></VAR>.

The explanation should:
- Be clear and concise
- Include practical examples
- Be approximately <VAR name="length" description="The length: short, medium, long" defaultValue="medium"></VAR> in length

Focus areas: <VAR name="focus_areas" description="The focus areas" defaultValue="general concepts"></VAR>

Additional context:
<VAR name="context" description="Additional context information" defaultValue="No additional context provided"></VAR>