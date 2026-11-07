import {describe,it,expect} from "vitest";
import {ONTOGENESIS_LINKS,validateResearchLink} from "./ontogenesisResearchLinks";
const link={eventId:"e1",episodeIndex:0,symbol:"Reso",mappingVersion:"0.1.0",sourceRepository:"thomaspeterkueper/omnizedenz.org",sourceRevision:"a".repeat(40),epistemicStatus:"hypothesis" as const};
describe("cross-repository ontogenesis contract",()=>{
 it("disables canonical writeback",()=>expect(ONTOGENESIS_LINKS.canonicalWriteback).toBe(false));
 it("references both domain owners",()=>expect(Object.keys(ONTOGENESIS_LINKS.sources)).toEqual(["philosophy","linguistics"]));
 it("accepts a fully identified research link",()=>expect(validateResearchLink(link)).toBe(true));
 it("rejects unknown repositories",()=>expect(validateResearchLink({...link,sourceRepository:"other/repo"})).toBe(false));
 it("rejects missing revision",()=>expect(validateResearchLink({...link,sourceRevision:"main"})).toBe(false));
 it("rejects invalid epistemic states",()=>expect(validateResearchLink({...link,epistemicStatus:"proven" as never})).toBe(false));
});
