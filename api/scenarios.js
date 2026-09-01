import { listScenarios } from "../lib/scenarios-data.js";

export default function handler(req, res) {
  res.status(200).json(listScenarios());
}
