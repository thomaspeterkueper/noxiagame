import type { InteriorInstance, InteriorTemplate, RoomId } from '../types'
import type { InteriorFunctionId } from './functions'
import { resolveRoomFunctions } from './resolution'
import {
  getInteriorFunctionDomainBinding,
  hasRequiredDomainObjects,
  type InteriorDomainObjectRef,
} from './domainBindings'

export interface InteriorFunctionInvocation {
  interiorInstanceId: string
  roomId: RoomId
  functionId: InteriorFunctionId
  objectRefs: readonly InteriorDomainObjectRef[]
}

export type InteriorFunctionInvocationIssueCode =
  | 'instance-template-mismatch'
  | 'unknown-room'
  | 'function-not-available-in-room'
  | 'missing-domain-binding'
  | 'missing-required-domain-object'

export interface InteriorFunctionInvocationIssue {
  code: InteriorFunctionInvocationIssueCode
  message: string
}

/**
 * Validates whether an interior interaction can be handed to the owning domain.
 * This function never executes the action and never mutates authoritative state.
 */
export function validateInteriorFunctionInvocation(
  template: InteriorTemplate,
  instance: InteriorInstance,
  invocation: InteriorFunctionInvocation,
): InteriorFunctionInvocationIssue[] {
  const issues: InteriorFunctionInvocationIssue[] = []

  if (instance.templateId !== template.id || invocation.interiorInstanceId !== instance.id) {
    issues.push({
      code: 'instance-template-mismatch',
      message: `Invocation ${invocation.functionId} does not target the supplied interior instance/template pair.`,
    })
  }

  const room = template.rooms.find(candidate => candidate.id === invocation.roomId)
  if (!room) {
    issues.push({
      code: 'unknown-room',
      message: `Unknown interior room: ${invocation.roomId}`,
    })
    return issues
  }

  const availableFunctionIds = resolveRoomFunctions(room).functions.map(definition => definition.id)
  if (!availableFunctionIds.includes(invocation.functionId)) {
    issues.push({
      code: 'function-not-available-in-room',
      message: `Function ${invocation.functionId} is not available in room ${room.id}.`,
    })
  }

  const binding = getInteriorFunctionDomainBinding(invocation.functionId)
  if (!binding) {
    issues.push({
      code: 'missing-domain-binding',
      message: `Function ${invocation.functionId} has no authoritative-domain binding.`,
    })
    return issues
  }

  if (!hasRequiredDomainObjects(binding, invocation.objectRefs)) {
    issues.push({
      code: 'missing-required-domain-object',
      message: `Function ${invocation.functionId} is missing one or more required domain object references.`,
    })
  }

  return issues
}
