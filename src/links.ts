import pkg from "../package.json";

export const SITE = pkg.homepage;
export const INSTALL_SCRIPT_URL = `${SITE}/install`;
export const INSTALL_CMD = `curl -fsSL ${INSTALL_SCRIPT_URL} | bash`;
