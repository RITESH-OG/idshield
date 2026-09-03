export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST only"});
  if(!process.env.GEMINI_API_KEY) return res.status(503).json({error:"GEMINI_API_KEY is not configured"});
  return res.status(200).json({message:"Gemini endpoint is configured for authorized server-side integration. Connect your production prompt/model here."});
}
