import { IncomingRequest, ResponseOutparam } from "wasi:http/types@0.2.3";
import type { InitResult } from "trailbase:runtime/init-endpoint";
import type { HttpHandlerInterface } from "./http";
import type { JobHandlerInterface } from "./job";
import { buildIncomingHttpHandler } from "./http/incoming";

export { addPeriodicCallback } from "./timer";

export * from "./util";
export type { InitResult } from "trailbase:runtime/init-endpoint";
export { threadId } from "trailbase:runtime/host-endpoint";

export interface Config {
  incomingHandler: {
    handle: (
      req: IncomingRequest,
      respOutparam: ResponseOutparam,
    ) => Promise<void>;
  };
  initEndpoint: {
    init: () => InitResult;
  };
}

export function defineConfig(args: {
  httpHandlers?: HttpHandlerInterface[];
  jobHandlers?: JobHandlerInterface[];
}): Config {
  return {
    incomingHandler: {
      handle: buildIncomingHttpHandler(args),
    },
    initEndpoint: {
      init: function (): InitResult {
        return {
          httpHandlers: (args.httpHandlers ?? []).map((h) => [
            h.method,
            h.path,
          ]),
          jobHandlers: (args.jobHandlers ?? []).map((h) => [h.name, h.spec]),
        };
      },
    },
  };
}
