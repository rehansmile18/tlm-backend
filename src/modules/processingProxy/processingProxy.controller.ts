import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { assertSameClient } from "../../middleware/tenantScope";
import { punchProcessorClient } from "../../clients/punchProcessorClient";
import { CreateProcessingRunInput } from "./processingProxy.validators";

/**
 * Authorizes the original caller against the requested clientId FIRST (this service's own
 * permission + scope checks), then calls punch-processor as the trusted service account — the
 * engine itself does no per-caller authorization for this call, it trusts the service identity.
 */
export const createProcessingRunHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateProcessingRunInput;
  assertSameClient(req, input.clientId);
  const result = await punchProcessorClient.triggerProcessing(input);
  res.status(207).json(result);
});
