/*
HMAC - Hash-based messaage authentication code
- Used for creating a secret and sending to merchant server so that he knows this service has sent
*/
import crypto from "crypto"

export const signPayload = (secret: string, payload: string) : string =>{
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/*
crypto.createHmac -> creates a generator with the given function name and secret
.update -> gives the payload to the generator which hashes the payload
.digest -> finalizes the calculation adn outputs the signature as readble hexadecimenl string
*/