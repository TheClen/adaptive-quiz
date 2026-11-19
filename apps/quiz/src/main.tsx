import "./styles/tokens.css";
import "./styles/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createFetchApiClient } from "./api/client.js";
import { ApiClientProvider } from "./app/ApiClientContext.js";
import { QuizApp } from "./app/QuizApp.js";
import { RunnerProvider } from "./app/RunnerContext.js";
import { createRunnerClient } from "./runner/runnerClient.js";

const container = document.getElementById("root");
if (container === null) {
  throw new Error('The page has no element with id "root"');
}

createRoot(container).render(
  <StrictMode>
    <ApiClientProvider client={createFetchApiClient()}>
      <RunnerProvider runner={createRunnerClient()}>
        <QuizApp />
      </RunnerProvider>
    </ApiClientProvider>
  </StrictMode>,
);
