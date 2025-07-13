import jwt from "jsonwebtoken";

const JWT_SECRET = import.meta.env.JWT_SECRET

function consume(token:string, userId:string) {
    if (!token) return false;
    
    try {
        // Verify the JWT
        const decoded = jwt.verify(token, JWT_SECRET) as {
            userId: string;
            type: string;
            timestamp: number;
            iat: number;
            exp: number;
        };
        
        // Check if the token is for captcha and belongs to the right user
        if (decoded.type !== "captcha" || decoded.userId !== userId) return false;
        
        // Check if token is not too old (optional extra check)
        const tokenAge = Date.now() - decoded.timestamp;
        if (tokenAge > 10 * 60 * 1000) return false;

        return true;
    } catch (error) {
        console.error("JWT verification error:", error);
        return false;
    }
};

function generateToken(userId:string) {
    const captchaToken = jwt.sign(
        { 
            userId,
            type: "captcha", 
            timestamp: Date.now() 
        }, 
        JWT_SECRET,
        { expiresIn: "10m" } // Token expires in 10 minutes
    );
    return captchaToken;
};

export { consume, generateToken };