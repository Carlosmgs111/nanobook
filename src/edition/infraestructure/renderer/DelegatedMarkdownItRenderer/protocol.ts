export type RenderRequest = {
    id: number;
    content: string;
  };
  
  export type RenderResponse =
    | {
        id: number;
        ok: true;
        html: string;
      }
    | {
        id: number;
        ok: false;
        error: string;
      };