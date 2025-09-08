/** @module Interface trailbase:runtime/init-endpoint **/
export function init(): InitResult;
/**
 * # Variants
 *
 * ## `"get"`
 *
 * ## `"post"`
 *
 * ## `"head"`
 *
 * ## `"options"`
 *
 * ## `"patch"`
 *
 * ## `"delete"`
 *
 * ## `"put"`
 *
 * ## `"trace"`
 *
 * ## `"connect"`
 */
export type MethodType = 'get' | 'post' | 'head' | 'options' | 'patch' | 'delete' | 'put' | 'trace' | 'connect';
export interface InitResult {
  /**
   * Registered http handlers (method, path)[].
   */
  httpHandlers: Array<[MethodType, string]>,
  /**
   * Registered jobs (name, spec)[].
   */
  jobHandlers: Array<[string, string]>,
}
