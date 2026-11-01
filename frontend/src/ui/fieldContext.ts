import { createContext, useContext } from "react";

export interface FieldControlProps {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
}

export const FieldContext = createContext<FieldControlProps | null>(null);

/** Props a form control inherits from the `<Field>` around it (id, description, invalid state). */
export function useFieldControlProps(): Partial<FieldControlProps> {
  return useContext(FieldContext) ?? {};
}
