import "./styles/tokens.css";
import "./styles/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createFetchApiClient } from "./api/client.js";
import { ApiClientProvider } from "./app/ApiClientContext.js";
import { QuizApp } from "./app/QuizApp.js";

const container = document.getElementById("root");
if (container === null) {
  throw new Error('The page has no element with id "root"');
}

createRoot(container).render(
  <StrictMode>
    <ApiClientProvider client={createFetchApiClient()}>
      <QuizApp />
    </ApiClientProvider>
  </StrictMode>,
);
