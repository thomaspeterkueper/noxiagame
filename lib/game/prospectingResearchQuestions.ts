import type { ObservationEnvironment,ObservationRequirement } from './population/observationCapability'
import { prospectingObservationCatalog } from './resourceObservationPlanning'
import { instrumentsForObservation,observationTechnologyGap } from './population/observationCapability'
import { prospectingDevelopmentOrder } from './prospectingDevelopmentOrder'

export interface ProspectingResearchQuestion{
 id:string
 title:string
 question:string
 learningPathId:string
 requirement:ObservationRequirement
}

export const PROSPECTING_RESEARCH_QUESTIONS:ProspectingResearchQuestion[]=[
 {id:'spectral-surface',title:'Oberflächenmaterial unterscheiden',question:'Welche spektrale Signatur besitzt das Material im Messgebiet?',learningPathId:'PATH:SSF:NOX-SCIENTIFIC-OBSERVATION-0001',requirement:{observable:'spectral_reflectance',environment:'surface',minRangeMeters:400}},
 {id:'magnetic-anomaly',title:'Magnetische Anomalie prüfen',question:'Gibt es eine lokale Magnetfeldanomalie, die eine weitere geologische Untersuchung rechtfertigt?',learningPathId:'PATH:SSF:NOX-SCIENTIFIC-OBSERVATION-0001',requirement:{observable:'magnetic_field_anomaly',environment:'surface',minRangeMeters:350}},
 {id:'density-contrast',title:'Dichtekontrast suchen',question:'Ist im Untergrund ein Massen- oder Dichtekontrast messbar?',learningPathId:'PATH:SSF:NOX-SCIENTIFIC-OBSERVATION-0001',requirement:{observable:'density_contrast',environment:'surface',minRangeMeters:450}},
 {id:'subsurface-structure',title:'Untergrundstruktur untersuchen',question:'Welche Untergrundstruktur ist im lokalen Messbereich seismisch erfassbar?',learningPathId:'PATH:SSF:NOX-SCIENTIFIC-OBSERVATION-0001',requirement:{observable:'subsurface_structure',environment:'surface',minRangeMeters:400}},
 {id:'regional-survey',title:'Region orbital vorsondieren',question:'Welche großräumigen Signaturen rechtfertigen eine lokale Messkampagne?',learningPathId:'PATH:SSF:NOX-SCIENTIFIC-OBSERVATION-0001',requirement:{observable:'regional_remote_sensing',environment:'orbital',minRangeMeters:4000}},
]

export function planProspectingQuestion(questionId:string,ownedInstrumentIds:readonly string[]){
 const question=PROSPECTING_RESEARCH_QUESTIONS.find(q=>q.id===questionId)
 if(!question)return null
 const catalog=prospectingObservationCatalog(ownedInstrumentIds)
 const matches=instrumentsForObservation(catalog,question.requirement)
 const gap=observationTechnologyGap(catalog,question.requirement)
 const developmentOrder=gap?prospectingDevelopmentOrder({questionId:question.id,learningPathId:question.learningPathId,gap}):null
 return {
  question,
  sufficientInstrumentIds:matches.filter(m=>m.sufficient).map(m=>m.profile.instrumentType),
  nearestCandidates:matches.slice(0,3).map(m=>({instrumentId:m.profile.instrumentType,gaps:m.gaps})),
  gap:gap?{missingDimensions:gap.missingDimensions,candidateInstrumentTypes:gap.candidateInstrumentTypes}:null,
  developmentOrder,
 }
}
