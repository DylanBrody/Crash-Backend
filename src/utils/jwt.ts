import { verify, TokenExpiredError } from "jsonwebtoken";
import { VerifyTokenStatus } from "../common/constants";

export const verifyTokenSignature = (accessToken: string, publicKey: string): VerifyTokenStatus => {

    if (accessToken === undefined || accessToken === null) {
        return VerifyTokenStatus.ACCESS_TOKEN_NOTFOUND
    }

    try {
        verify(accessToken, publicKey, { algorithms: ["RS256"] });
        return VerifyTokenStatus.SUCCESS;
    }
    catch (err) {
        if (err instanceof TokenExpiredError) {
            return VerifyTokenStatus.TOKEN_EXPIRED;
        }

        return VerifyTokenStatus.SIGNATURE_VERIFICATION_FAILURE;
    }

}