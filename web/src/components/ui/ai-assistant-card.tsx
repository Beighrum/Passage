import {
  ChartNetworkIcon,
  ImageIcon,
  MapIcon,
  PenToolIcon,
  ScanTextIcon,
  SparklesIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function AiAssistantCard({
  name = "there",
  onPrompt,
}: {
  name?: string;
  onPrompt?: (text: string) => void;
}) {
  return (
    <Card className="flex h-full min-h-[720px] w-full max-w-[520px] flex-col gap-6 p-4 shadow-none bg-white/85 backdrop-blur-md border-border">
      <div className="flex flex-row items-center justify-end p-0">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-muted-foreground"
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 5a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M4 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M4 19a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0"
            />
          </svg>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 text-muted-foreground"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M18 6l-12 12" />
            <path d="M6 6l12 12" />
          </svg>
        </Button>
      </div>

      <CardContent className="flex flex-1 flex-col p-0">
        <div className="flex flex-col items-center justify-center space-y-8 p-6">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <SparklesIcon className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>

          <div className="flex flex-col space-y-2.5 text-center">
            <div className="flex flex-col">
              <h2 className="text-xl font-medium tracking-tight text-muted-foreground">Hi {name},</h2>
              <h3 className="text-lg font-medium tracking-[-0.006em] text-foreground">
                Welcome back! How can I help?
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              I’m here to help with grants, programming, strategy, and staff workflows. Pick a prompt or tell me what you need.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge
              variant="secondary"
              className="h-7 min-w-7 cursor-pointer gap-1.5 text-xs [&_svg]:-ms-px [&_svg]:shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5 rounded-md"
              onClick={() => onPrompt?.("Draft a grant narrative (start with a tight 150-word overview).")}
            >
              <ScanTextIcon aria-hidden="true" className="text-primary" />
              Draft narrative
            </Badge>
            <Badge
              variant="secondary"
              className="h-7 min-w-7 cursor-pointer gap-1.5 text-xs [&_svg]:-ms-px [&_svg]:shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5 rounded-md"
              onClick={() => onPrompt?.("Triage this NOFA: summarize priorities, fit, risks, and a go/no-go recommendation.")}
            >
              <ChartNetworkIcon aria-hidden="true" className="text-primary" />
              Triage a NOFA
            </Badge>
            <Badge
              variant="secondary"
              className="h-7 min-w-7 cursor-pointer gap-1.5 text-xs [&_svg]:-ms-px [&_svg]:shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5 rounded-md"
              onClick={() => onPrompt?.("Make a project plan with milestones, owner, and deadlines.")}
            >
              <MapIcon aria-hidden="true" className="text-primary" />
              Make a plan
            </Badge>
            <Badge
              variant="secondary"
              className="h-7 min-w-7 cursor-pointer gap-1.5 text-xs [&_svg]:-ms-px [&_svg]:shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5 rounded-md"
              onClick={() => onPrompt?.("Help me write: turn my bullets into a polished paragraph in Passage voice.")}
            >
              <PenToolIcon aria-hidden="true" className="text-primary" />
              Help me write
            </Badge>
            <Badge
              variant="secondary"
              className="h-7 min-w-7 cursor-pointer gap-1.5 text-xs [&_svg]:-ms-px [&_svg]:shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5 rounded-md"
              onClick={() => onPrompt?.("More: suggest 6 high-value staff workflows I can run here.")}
            >
              <SparklesIcon aria-hidden="true" className="text-primary" />
              More
            </Badge>
            <Badge
              variant="secondary"
              className="h-7 min-w-7 cursor-pointer gap-1.5 text-xs [&_svg]:-ms-px [&_svg]:shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5 rounded-md opacity-70"
            >
              <ImageIcon aria-hidden="true" className="text-primary" />
              (No images)
            </Badge>
          </div>
        </div>

        <div className="relative mt-auto flex-col rounded-md ring-1 ring-border bg-background">
          <div className="relative">
            <Textarea
              placeholder="Ask me anything…"
              className="peer bg-transparent min-h-[100px] resize-none rounded-b-none border-none py-3 ps-9 pe-9 shadow-none"
            />

            <div className="pointer-events-none absolute start-0 top-[14px] flex items-center justify-center ps-3 text-muted-foreground/80 peer-disabled:opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" className="h-4 w-4">
                <g fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11.5" cy="11.5" r="9.5" />
                  <path strokeLinecap="round" d="M18.5 18.5L22 22" />
                </g>
              </svg>
            </div>

            <button
              className="absolute end-0 bottom-7 flex h-full w-9 items-center justify-center rounded-e-md text-muted-foreground/80 transition-colors outline-none hover:text-foreground focus:z-10 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Record audio"
              type="button"
            />
          </div>

          <div className="flex items-center justify-between rounded-b-md border-t bg-muted/50 px-3 py-2">
            <Select defaultValue="passage-internal">
              <SelectTrigger className="h-7 w-[140px] bg-background text-xs">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="text-xs" value="passage-internal">
                  Passage (internal)
                </SelectItem>
                <SelectItem className="text-xs" value="passage-public" disabled>
                  Public (disabled)
                </SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Button className="h-7 gap-2 px-2 text-xs" variant="ghost" type="button">
                Attach
              </Button>
              <Button className="h-7 gap-2 px-2 text-xs" variant="ghost" type="button">
                Shortcuts
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

