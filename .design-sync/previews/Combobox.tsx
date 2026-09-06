import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput,
  ComboboxItem, ComboboxList,
} from "@/components/ui/combobox";

const crews = ["Crew A — Dana Ramos", "Crew B — Kim Ide", "Crew C — Pat O'Brien", "Crew D — contract"];

export function AssignCrew() {
  return (
    <div className="w-full max-w-sm">
      <Combobox items={crews} defaultValue={crews[0]} defaultOpen modal={false}>
        <ComboboxInput placeholder="Assign a crew" />
        <ComboboxContent>
          <ComboboxEmpty>No crew matched.</ComboboxEmpty>
          <ComboboxList>
            {crews.map((crew) => (
              <ComboboxItem key={crew} value={crew}>
                {crew}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
