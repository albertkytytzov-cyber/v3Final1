import { bootstrapMobileApp } from "./screens/app.js";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("Mobile app root was not found");
}

bootstrapMobileApp(root);
