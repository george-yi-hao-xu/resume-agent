import type { RunPatchState } from "./run.js";

// if the instruction has sth. like translate, clone page, etc. 
// then full dom is needed to be passed to the llm
export function useFullDom(s: RunPatchState){

    return s as RunPatchState
}
