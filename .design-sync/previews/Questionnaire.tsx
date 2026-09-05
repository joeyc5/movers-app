import {
  Questionnaire, QuestionnaireActions, QuestionnaireChoice, QuestionnaireChoiceDescription,
  QuestionnaireChoices, QuestionnaireDescription, QuestionnaireItem, QuestionnaireNext,
  QuestionnaireProgress, QuestionnaireTitle,
} from "@/components/ui/questionnaire";

export function Intake() {
  return (
    <Questionnaire className="w-full max-w-md">
      <QuestionnaireProgress />
      <QuestionnaireItem name="service">
        <QuestionnaireTitle>What kind of move is this?</QuestionnaireTitle>
        <QuestionnaireDescription>Pick the closest match.</QuestionnaireDescription>
        <QuestionnaireChoices>
          <QuestionnaireChoice value="local" defaultChecked>
            Local
            <QuestionnaireChoiceDescription>Within 100 miles</QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
          <QuestionnaireChoice value="long">
            Long distance
            <QuestionnaireChoiceDescription>State to state</QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
          <QuestionnaireChoice value="commercial">
            Commercial
            <QuestionnaireChoiceDescription>Office or warehouse</QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
        </QuestionnaireChoices>
        <QuestionnaireActions>
          <QuestionnaireNext>Continue</QuestionnaireNext>
        </QuestionnaireActions>
      </QuestionnaireItem>
    </Questionnaire>
  );
}
