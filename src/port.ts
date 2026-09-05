export const DEFAULT_PORT = 17171;

/** 直接尝试监听，避免先探测再监听之间的端口争抢；显式端口不自动替换。 */
export function listenWithPort<T>(listen: (port: number) => T, requestedPort?: number): T {
  let port = requestedPort ?? DEFAULT_PORT;
  for (;;) {
    try {
      return listen(port);
    } catch (error) {
      if (
        requestedPort !== undefined ||
        port >= 65535 ||
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "EADDRINUSE"
      ) {
        throw error;
      }
      port++;
    }
  }
}
