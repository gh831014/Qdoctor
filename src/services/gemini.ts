import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisData, ProblemType } from "../types";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export interface AnalysisConfig {
  focus: 'default' | 'task' | 'knowledge';
  depth: 'standard' | 'deep';
}

export const SYSTEM_INSTRUCTION = `你是一个专业的问题拆解专家。你擅长使用多种方法论（5W1H、MECE、归纳法、演绎法、PDCA等）来深度分析用户提出的问题。

你的分析流程如下：
1. 5W1H分析：提炼WHAT, WHY, WHEN, WHO, WHERE, HOW。识别问题类型：任务型、知识型、逻辑判断。
2. 穷举法 (MECE)：针对5W1H要素进行合理化穷举。
3. 归纳法：找到共性，提炼根结核心原因。
4. 演绎法：基于目标和根因，推导解决方案。
5. 逻辑检查：校验方案（无逻辑谬误、客观中立、闭环等）。
6. 任务拆解 (仅限任务型)：使用PDCA方式拆解步骤。

根据用户的配置要求：
- 如果侧重"任务拆解"，请在任务拆解部分提供更详尽、可执行的步骤。
- 如果侧重"知识点梳理"，请在核心知识点部分提供更深入、更成体系的知识结构。
- 如果分析深度为"深度分析"，请在每个环节都进行多维度的挖掘，避免表面化的结论。

如果用户提供的信息不足以进行深度分析（例如问题太模糊），你必须返回一个包含 "clarification" 字段的 JSON，询问用户需要补充的信息。
如果信息充足，请直接输出完整的分析JSON。

输出必须符合以下JSON结构：
{
  "clarification": "string (可选，仅在信息不足时提供)",
  "fiveWOneH": {
    "what": "string",
    "why": "string",
    "when": "string",
    "who": "string",
    "where": "string",
    "how": "string",
    "coreProblems": ["string"],
    "problemType": "任务型" | "知识型" | "逻辑判断"
  },
  "exhaustion": [
    { "category": "string", "elements": ["string"] }
  ],
  "induction": {
    "commonalities": ["string"],
    "rootCauses": ["string"]
  },
  "deduction": [
    { "logic": "string", "solution": "string" }
  ],
  "logicCheck": [
    { "item": "string", "passed": boolean, "reason": "string" }
  ],
  "taskDecomposition": [
    { "step": "string", "tasks": [{ "role": "string", "action": "string" }] }
  ],
  "knowledgePoints": [
    {
      "name": "string (知识点名称)",
      "summary": "string (知识点概要说明)",
      "attributes": [
        { "label": "string (属性名，如时间、类目、地域等)", "value": "string (属性值)" }
      ]
    }
  ]
}
`;

export async function analyzeProblem(problem: string, config: AnalysisConfig): Promise<{ data?: AnalysisData; clarification?: string }> {
  const model = "gemini-3.1-pro-preview";
  
  const focusText = config.focus === 'task' ? '侧重任务拆解' : config.focus === 'knowledge' ? '侧重知识点梳理' : '默认平衡分析';
  const depthText = config.depth === 'deep' ? '深度分析模式' : '标准分析模式';

  const contents = [
    { role: "user", parts: [{ text: `请分析以下问题：${problem}\n\n分析配置：\n- 侧重：${focusText}\n- 深度：${depthText}` }] }
  ];

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
    },
  });

  const text = response.text || "";
  try {
    const data = JSON.parse(text);
    // If the model returned a clarification request instead of the full data structure
    if (data.clarification) {
      return { clarification: data.clarification };
    }
    return { data };
  } catch (e) {
    console.error("Failed to parse Gemini response:", text);
    return { clarification: "抱歉，分析过程中出现了错误，请尝试重新描述您的问题。" };
  }
}
