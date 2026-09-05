"use client";

import { useState } from "react";

import { Star } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { type DocumentItem, fileIcons, visibilityLabels } from "./data";
import { FileActions } from "./file-actions";

interface FileListViewProps {
  files: DocumentItem[];
}

export function FileListView({ files }: FileListViewProps) {
  const [listFiles, setListFiles] = useState(files);

  function toggleStar(fileId: string) {
    setListFiles((current) => current.map((file) => (file.id === fileId ? { ...file, starred: !file.starred } : file)));
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-0">Name</TableHead>
          <TableHead className="hidden md:table-cell">Owner</TableHead>
          <TableHead className="hidden lg:table-cell">Modified</TableHead>
          <TableHead className="hidden sm:table-cell">Size</TableHead>
          <TableHead className="w-20">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {listFiles.map((file) => {
          const FileIcon = fileIcons[file.kind];

          return (
            <TableRow key={file.id}>
              <TableCell className="pl-0">
                <div className="flex min-w-0 items-center gap-3">
                  <FileIcon className="size-5 shrink-0 text-muted-foreground" />
                  <Button variant="link" size="sm" className="h-auto max-w-72 justify-start px-0">
                    <span className="truncate">{file.name}</span>
                  </Button>
                  <Badge variant="outline" className="hidden xl:inline-flex">
                    {visibilityLabels[file.visibility]}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback>{file.ownerInitials}</AvatarFallback>
                  </Avatar>
                  <span>{file.ownerName}</span>
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">{file.modifiedAt}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={file.starred ? `Unstar ${file.name}` : `Star ${file.name}`}
                    onClick={() => toggleStar(file.id)}
                  >
                    <Star className={cn(file.starred && "fill-current")} />
                  </Button>
                  <FileActions file={file} onToggleStar={() => toggleStar(file.id)} />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
