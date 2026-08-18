/**
 * Hand-written BPMN 2.0 fixtures, one per execution pattern under test.
 * Diagram interchange is intentionally omitted; the engine only needs semantics.
 */

const NS =
  'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
  'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
  'targetNamespace="http://bpmn-flow.test"';

function wrap(inner: string, processId = 'P'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ${NS} id="Defs">
  <bpmn:process id="${processId}" isExecutable="true">
${inner}
  </bpmn:process>
</bpmn:definitions>`;
}

function cond(body: string): string {
  return `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${body}</bpmn:conditionExpression>`;
}

export const LINEAR = wrap(`
    <bpmn:startEvent id="Start" />
    <bpmn:serviceTask id="Charge" name="Charge card" />
    <bpmn:userTask id="Approve" name="Manual approval" />
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f1" sourceRef="Start" targetRef="Charge" />
    <bpmn:sequenceFlow id="f2" sourceRef="Charge" targetRef="Approve" />
    <bpmn:sequenceFlow id="f3" sourceRef="Approve" targetRef="End" />`);

export const EXCLUSIVE = wrap(`
    <bpmn:startEvent id="Start" />
    <bpmn:exclusiveGateway id="Gw" default="fLow" />
    <bpmn:task id="High" />
    <bpmn:task id="Low" />
    <bpmn:endEvent id="EndHigh" />
    <bpmn:endEvent id="EndLow" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Gw" />
    <bpmn:sequenceFlow id="fHigh" sourceRef="Gw" targetRef="High">${cond('amount &gt; 100')}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="fLow" sourceRef="Gw" targetRef="Low" />
    <bpmn:sequenceFlow id="fh2" sourceRef="High" targetRef="EndHigh" />
    <bpmn:sequenceFlow id="fl2" sourceRef="Low" targetRef="EndLow" />`);

export const PARALLEL = wrap(`
    <bpmn:startEvent id="Start" />
    <bpmn:parallelGateway id="Split" />
    <bpmn:task id="A" />
    <bpmn:task id="B" />
    <bpmn:parallelGateway id="Join" />
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Split" />
    <bpmn:sequenceFlow id="fa" sourceRef="Split" targetRef="A" />
    <bpmn:sequenceFlow id="fb" sourceRef="Split" targetRef="B" />
    <bpmn:sequenceFlow id="fa2" sourceRef="A" targetRef="Join" />
    <bpmn:sequenceFlow id="fb2" sourceRef="B" targetRef="Join" />
    <bpmn:sequenceFlow id="fj" sourceRef="Join" targetRef="End" />`);

export const INCLUSIVE = wrap(`
    <bpmn:startEvent id="Start" />
    <bpmn:inclusiveGateway id="Split" default="fDef" />
    <bpmn:task id="X" />
    <bpmn:task id="Y" />
    <bpmn:task id="Z" />
    <bpmn:inclusiveGateway id="Join" />
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Split" />
    <bpmn:sequenceFlow id="fx" sourceRef="Split" targetRef="X">${cond('a === true')}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="fy" sourceRef="Split" targetRef="Y">${cond('b === true')}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="fDef" sourceRef="Split" targetRef="Z" />
    <bpmn:sequenceFlow id="fx2" sourceRef="X" targetRef="Join" />
    <bpmn:sequenceFlow id="fy2" sourceRef="Y" targetRef="Join" />
    <bpmn:sequenceFlow id="fz2" sourceRef="Z" targetRef="Join" />
    <bpmn:sequenceFlow id="fj" sourceRef="Join" targetRef="End" />`);

export const EVENT_BASED = wrap(`
    <bpmn:startEvent id="Start" />
    <bpmn:eventBasedGateway id="Gw" />
    <bpmn:intermediateCatchEvent id="OnApproved">
      <bpmn:messageEventDefinition />
    </bpmn:intermediateCatchEvent>
    <bpmn:intermediateCatchEvent id="OnRejected">
      <bpmn:messageEventDefinition />
    </bpmn:intermediateCatchEvent>
    <bpmn:task id="Ship" />
    <bpmn:task id="Cancel" />
    <bpmn:endEvent id="EndA" />
    <bpmn:endEvent id="EndB" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Gw" />
    <bpmn:sequenceFlow id="fa" sourceRef="Gw" targetRef="OnApproved" />
    <bpmn:sequenceFlow id="fb" sourceRef="Gw" targetRef="OnRejected" />
    <bpmn:sequenceFlow id="fa2" sourceRef="OnApproved" targetRef="Ship" />
    <bpmn:sequenceFlow id="fb2" sourceRef="OnRejected" targetRef="Cancel" />
    <bpmn:sequenceFlow id="fa3" sourceRef="Ship" targetRef="EndA" />
    <bpmn:sequenceFlow id="fb3" sourceRef="Cancel" targetRef="EndB" />`);

export const BOUNDARY_ERROR = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ${NS} id="Defs">
  <bpmn:error id="Err" name="PaymentFailed" errorCode="PAYMENT_FAILED" />
  <bpmn:process id="P" isExecutable="true">
    <bpmn:startEvent id="Start" />
    <bpmn:serviceTask id="Pay" name="Take payment" />
    <bpmn:boundaryEvent id="OnFail" attachedToRef="Pay">
      <bpmn:errorEventDefinition errorRef="Err" />
    </bpmn:boundaryEvent>
    <bpmn:task id="Fulfil" />
    <bpmn:task id="Refund" />
    <bpmn:endEvent id="EndOk" />
    <bpmn:endEvent id="EndFail" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Pay" />
    <bpmn:sequenceFlow id="f1" sourceRef="Pay" targetRef="Fulfil" />
    <bpmn:sequenceFlow id="f2" sourceRef="Fulfil" targetRef="EndOk" />
    <bpmn:sequenceFlow id="fb" sourceRef="OnFail" targetRef="Refund" />
    <bpmn:sequenceFlow id="fb2" sourceRef="Refund" targetRef="EndFail" />
  </bpmn:process>
</bpmn:definitions>`;

export const SUBPROCESS = wrap(`
    <bpmn:startEvent id="Start" />
    <bpmn:subProcess id="Sub" name="Review">
      <bpmn:startEvent id="SubStart" />
      <bpmn:serviceTask id="Inner" />
      <bpmn:endEvent id="SubEnd" />
      <bpmn:sequenceFlow id="s1" sourceRef="SubStart" targetRef="Inner" />
      <bpmn:sequenceFlow id="s2" sourceRef="Inner" targetRef="SubEnd" />
    </bpmn:subProcess>
    <bpmn:task id="After" />
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Sub" />
    <bpmn:sequenceFlow id="f1" sourceRef="Sub" targetRef="After" />
    <bpmn:sequenceFlow id="f2" sourceRef="After" targetRef="End" />`);

export const TERMINATE = wrap(`
    <bpmn:startEvent id="Start" />
    <bpmn:parallelGateway id="Split" />
    <bpmn:userTask id="Work" />
    <bpmn:endEvent id="Stop">
      <bpmn:terminateEventDefinition />
    </bpmn:endEvent>
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Split" />
    <bpmn:sequenceFlow id="fa" sourceRef="Split" targetRef="Work" />
    <bpmn:sequenceFlow id="fb" sourceRef="Split" targetRef="Stop" />
    <bpmn:sequenceFlow id="fa2" sourceRef="Work" targetRef="End" />`);

export const CATCH_WAIT = wrap(`
    <bpmn:startEvent id="Start" />
    <bpmn:intermediateCatchEvent id="WaitMsg">
      <bpmn:messageEventDefinition />
    </bpmn:intermediateCatchEvent>
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="WaitMsg" />
    <bpmn:sequenceFlow id="f1" sourceRef="WaitMsg" targetRef="End" />`);

export const BOUNDARY_NON_INTERRUPTING = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ${NS} id="Defs">
  <bpmn:signal id="Sig" name="Escalated" />
  <bpmn:process id="P" isExecutable="true">
    <bpmn:startEvent id="Start" />
    <bpmn:userTask id="Work" />
    <bpmn:boundaryEvent id="OnPing" attachedToRef="Work" cancelActivity="false">
      <bpmn:signalEventDefinition signalRef="Sig" />
    </bpmn:boundaryEvent>
    <bpmn:task id="Notify" />
    <bpmn:endEvent id="EndNotify" />
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Work" />
    <bpmn:sequenceFlow id="f1" sourceRef="Work" targetRef="End" />
    <bpmn:sequenceFlow id="fb" sourceRef="OnPing" targetRef="Notify" />
    <bpmn:sequenceFlow id="fb2" sourceRef="Notify" targetRef="EndNotify" />
  </bpmn:process>
</bpmn:definitions>`;

export const SUBPROCESS_ERROR = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ${NS} id="Defs">
  <bpmn:error id="Err" name="OutOfStock" errorCode="OUT_OF_STOCK" />
  <bpmn:process id="P" isExecutable="true">
    <bpmn:startEvent id="Start" />
    <bpmn:subProcess id="Sub">
      <bpmn:startEvent id="SubStart" />
      <bpmn:exclusiveGateway id="SubGw" default="sFail" />
      <bpmn:endEvent id="SubOk" />
      <bpmn:endEvent id="SubFail">
        <bpmn:errorEventDefinition errorRef="Err" />
      </bpmn:endEvent>
      <bpmn:sequenceFlow id="s0" sourceRef="SubStart" targetRef="SubGw" />
      <bpmn:sequenceFlow id="sOk" sourceRef="SubGw" targetRef="SubOk">${cond('ok === true')}</bpmn:sequenceFlow>
      <bpmn:sequenceFlow id="sFail" sourceRef="SubGw" targetRef="SubFail" />
    </bpmn:subProcess>
    <bpmn:boundaryEvent id="OnSubError" attachedToRef="Sub">
      <bpmn:errorEventDefinition errorRef="Err" />
    </bpmn:boundaryEvent>
    <bpmn:task id="After" />
    <bpmn:task id="Recover" />
    <bpmn:endEvent id="End" />
    <bpmn:endEvent id="EndRecovered" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Sub" />
    <bpmn:sequenceFlow id="f1" sourceRef="Sub" targetRef="After" />
    <bpmn:sequenceFlow id="f2" sourceRef="After" targetRef="End" />
    <bpmn:sequenceFlow id="fb" sourceRef="OnSubError" targetRef="Recover" />
    <bpmn:sequenceFlow id="fb2" sourceRef="Recover" targetRef="EndRecovered" />
  </bpmn:process>
</bpmn:definitions>`;

export const SUBPROCESS_TERMINATE = wrap(`
    <bpmn:startEvent id="Start" />
    <bpmn:subProcess id="Sub">
      <bpmn:startEvent id="SubStart" />
      <bpmn:parallelGateway id="SubSplit" />
      <bpmn:userTask id="SubWork" />
      <bpmn:endEvent id="SubStop">
        <bpmn:terminateEventDefinition />
      </bpmn:endEvent>
      <bpmn:endEvent id="SubEnd" />
      <bpmn:sequenceFlow id="s0" sourceRef="SubStart" targetRef="SubSplit" />
      <bpmn:sequenceFlow id="sa" sourceRef="SubSplit" targetRef="SubWork" />
      <bpmn:sequenceFlow id="sb" sourceRef="SubSplit" targetRef="SubStop" />
      <bpmn:sequenceFlow id="sa2" sourceRef="SubWork" targetRef="SubEnd" />
    </bpmn:subProcess>
    <bpmn:task id="After" />
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Sub" />
    <bpmn:sequenceFlow id="f1" sourceRef="Sub" targetRef="After" />
    <bpmn:sequenceFlow id="f2" sourceRef="After" targetRef="End" />`);

export const ENDLESS_LOOP = wrap(`
    <bpmn:startEvent id="Start" />
    <bpmn:task id="Spin" />
    <bpmn:exclusiveGateway id="Again" default="fBack" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Spin" />
    <bpmn:sequenceFlow id="f1" sourceRef="Spin" targetRef="Again" />
    <bpmn:sequenceFlow id="fBack" sourceRef="Again" targetRef="Spin" />`);

export const PARALLEL_WAIT = wrap(`
    <bpmn:startEvent id="Start" />
    <bpmn:parallelGateway id="Split" />
    <bpmn:userTask id="TaskA" />
    <bpmn:userTask id="TaskB" />
    <bpmn:parallelGateway id="Join" />
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Split" />
    <bpmn:sequenceFlow id="fa" sourceRef="Split" targetRef="TaskA" />
    <bpmn:sequenceFlow id="fb" sourceRef="Split" targetRef="TaskB" />
    <bpmn:sequenceFlow id="fa2" sourceRef="TaskA" targetRef="Join" />
    <bpmn:sequenceFlow id="fb2" sourceRef="TaskB" targetRef="Join" />
    <bpmn:sequenceFlow id="fj" sourceRef="Join" targetRef="End" />`);

export const SUBPROCESS_WAIT = wrap(`
    <bpmn:startEvent id="Start" />
    <bpmn:subProcess id="Sub" name="Review">
      <bpmn:startEvent id="SubStart" />
      <bpmn:userTask id="Review" />
      <bpmn:endEvent id="SubEnd" />
      <bpmn:sequenceFlow id="s1" sourceRef="SubStart" targetRef="Review" />
      <bpmn:sequenceFlow id="s2" sourceRef="Review" targetRef="SubEnd" />
    </bpmn:subProcess>
    <bpmn:task id="After" />
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Sub" />
    <bpmn:sequenceFlow id="f1" sourceRef="Sub" targetRef="After" />
    <bpmn:sequenceFlow id="f2" sourceRef="After" targetRef="End" />`);
