import OpenAI from "openai";

try {
    const openai = new OpenAI(
        {
            // If the environment variable is not configured, replace with: apiKey: "sk-xxx"
            apiKey: process.env.DASHSCOPE_API_KEY,
            // The following URL is for the Singapore region. When calling, replace WorkspaceId with your actual workspace ID. URLs vary by region.
            baseURL: "https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1"
        }
    );
    const completion = await openai.chat.completions.create({
        model: "",  
        messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Who are you?" }
        ],
    });
    console.log(completion.choices[0].message.content);
} catch (error) {
    console.log(`Error message: ${error}`);
    console.log("See: https://www.alibabacloud.com/help/model-studio/developer-reference/error-code");
}