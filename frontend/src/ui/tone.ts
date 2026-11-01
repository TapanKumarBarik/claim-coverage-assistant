import { TONE, type Tone } from "../constants/tone";
import "./tone.css";

/** CSS class that sets `--tone-bg/-fg/-border` for a tone. Components consume those variables. */
export const TONE_CLASS: Record<Tone, string> = {
  [TONE.NEUTRAL]: "tone--neutral",
  [TONE.OK]: "tone--ok",
  [TONE.WARNING]: "tone--warning",
  [TONE.DANGER]: "tone--danger",
  [TONE.INFO]: "tone--info",
};
