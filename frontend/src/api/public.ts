import { HTTP_METHOD } from "../constants/http";
import { request } from "./client";
import { API_PATH } from "./paths";
import type { AnalyzeRequest, AnalyzeResponse, ContractPublic, Example, Feedback, FeedbackInput } from "./types";

export const publicApi = {
  contracts: () => request<ContractPublic[]>(API_PATH.contracts),
  examples: () => request<Example[]>(API_PATH.examples),
  analyze: (body: AnalyzeRequest) => request<AnalyzeResponse>(API_PATH.analyze, { method: HTTP_METHOD.POST, json: body }),
  feedback: (body: FeedbackInput) => request<Feedback>(API_PATH.feedback, { method: HTTP_METHOD.POST, json: body }),
};
