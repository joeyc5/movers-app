import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCaption, TableCell, TableFooter,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const deals = [
  { id: "1042", client: "Acme Relocation", stage: "Quoted", crew: "A", value: "$3,400" },
  { id: "1039", client: "Beckett Household", stage: "Booked", crew: "B", value: "$2,150" },
  { id: "1031", client: "Novato Office Park", stage: "Surveyed", crew: "—", value: "$11,900" },
];

export function DealsTable() {
  return (
    <Table>
      <TableCaption>Open deals, week of 16 March</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Deal</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Crew</TableHead>
          <TableHead className="text-right">Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deals.map((d) => (
          <TableRow key={d.id}>
            <TableCell className="font-medium tabular-nums">#{d.id}</TableCell>
            <TableCell>{d.client}</TableCell>
            <TableCell>
              <Badge variant="secondary">{d.stage}</Badge>
            </TableCell>
            <TableCell>{d.crew}</TableCell>
            <TableCell className="text-right tabular-nums">{d.value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={4}>Total</TableCell>
          <TableCell className="text-right tabular-nums">$17,450</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
