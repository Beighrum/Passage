import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Check, ChevronDown, FileText, Loader2, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";

/* --- UTILS --- */
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

interface AttachedFile {
  id: string;
  file: File;
  type: string;
  preview: string | null;
  uploadStatus: "pending" | "uploading" | "complete";
}

function FilePreviewCard({
  file,
  onRemove,
}: {
  file: AttachedFile;
  onRemove: (id: string) => void;
}) {
  const isImage = file.type.startsWith("image/") && file.preview;

  return (
    <div
      className={cn(
        "relative group flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-bg-300 bg-bg-100 animate-fade-in transition-all hover:border-text-400",
      )}
    >
      {isImage ? (
        <div className="w-full h-full relative">
          <img src={file.preview!} alt={file.file.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
        </div>
      ) : (
        <div className="w-full h-full p-3 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-bg-200 rounded">
              <FileText className="w-4 h-4 text-text-300" />
            </div>
            <span className="text-[10px] font-medium text-text-400 uppercase tracking-wider truncate">
              {file.file.name.split(".").pop()}
            </span>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-text-200 truncate" title={file.file.name}>
              {file.file.name}
            </p>
            <p className="text-[10px] text-text-500">{formatFileSize(file.file.size)}</p>
          </div>
        </div>
      )}

      <button
        onClick={() => onRemove(file.id)}
        className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
        type="button"
        aria-label="Remove file"
      >
        <X className="w-3 h-3" />
      </button>

      {file.uploadStatus === "uploading" && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        </div>
      )}
    </div>
  );
}

interface Model {
  id: string;
  name: string;
  description: string;
  badge?: string;
}

function ModelSelector({
  models,
  selectedModel,
  onSelect,
}: {
  models: Model[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = models.find((m) => m.id === selectedModel) || models[0]!;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center justify-center relative shrink-0 transition font-base duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)] h-8 rounded-xl px-3 min-w-[4rem] active:scale-[0.98] whitespace-nowrap text-xs pl-2.5 pr-2 gap-1",
          isOpen
            ? "bg-bg-200 text-text-100"
            : "text-text-300 hover:text-text-200 hover:bg-bg-200",
        )}
        type="button"
        aria-label="Select model"
      >
        <div className="inline-flex gap-[3px] text-[14px] h-[14px] leading-none items-baseline">
          <div className="flex items-center gap-[4px]">
            <div className="whitespace-nowrap select-none font-medium">{currentModel.name}</div>
          </div>
        </div>
        <div className="flex items-center justify-center opacity-75" style={{ width: 20, height: 20 }}>
          <ChevronDown
            className={cn("shrink-0 opacity-75 transition-transform duration-200", isOpen && "rotate-180")}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-[260px] bg-bg-100 border border-bg-300 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col p-1.5 animate-fade-in origin-bottom-right">
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                onSelect(model.id);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl flex items-start justify-between group transition-colors hover:bg-bg-200"
              type="button"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-text-100">{model.name}</span>
                  {model.badge ? (
                    <span className="px-1.5 py-[1px] rounded-full text-[10px] font-medium border border-bg-300 text-text-300">
                      {model.badge}
                    </span>
                  ) : null}
                </div>
                <span className="text-[11px] text-text-300">{model.description}</span>
              </div>
              {selectedModel === model.id ? (
                <Check className="w-4 h-4 text-accent mt-1" />
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type ClaudeChatInputSendPayload = {
  message: string;
  files: AttachedFile[];
  model: string;
};

export function ClaudeChatInput({
  onSendMessage,
  placeholder = "How can I help you today?",
  disabled,
}: {
  onSendMessage: (data: ClaudeChatInputSendPayload) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedModel, setSelectedModel] = useState("sonnet");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const models = useMemo<Model[]>(
    () => [
      { id: "opus", name: "Opus", description: "Most capable for complex work" },
      { id: "sonnet", name: "Sonnet", description: "Best for everyday tasks" },
      { id: "haiku", name: "Haiku", description: "Fastest for quick answers" },
    ],
    [],
  );

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 384)}px`;
  }, [message]);

  const handleFiles = useCallback((newFilesList: FileList | File[]) => {
    const newFiles = Array.from(newFilesList).map((file) => {
      const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
      return {
        id: crypto.randomUUID(),
        file,
        type: isImage ? "image/unknown" : file.type || "application/octet-stream",
        preview: isImage ? URL.createObjectURL(file) : null,
        uploadStatus: "complete" as const,
      };
    });

    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const handleSend = () => {
    if (disabled) return;
    if (!message.trim() && files.length === 0) return;
    onSendMessage({ message, files, model: selectedModel });
    setMessage("");
    setFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasContent = message.trim() || files.length > 0;

  return (
    <div
      className="relative w-full max-w-2xl mx-auto transition-all duration-300 font-sans"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        className={cn(
          "box-content flex flex-col mx-2 md:mx-0 items-stretch transition-all duration-200 relative z-10 rounded-2xl cursor-text border border-bg-300",
          "shadow-[0_0_15px_rgba(0,0,0,0.08)] hover:shadow-[0_0_20px_rgba(0,0,0,0.12)] focus-within:shadow-[0_0_25px_rgba(0,0,0,0.15)]",
          "bg-bg-100 font-sans antialiased",
          disabled && "opacity-60 pointer-events-none",
        )}
      >
        <div className="flex flex-col px-3 pt-3 pb-2 gap-2">
          {files.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 px-1">
              {files.map((file) => (
                <FilePreviewCard
                  key={file.id}
                  file={file}
                  onRemove={(id) => {
                    setFiles((prev) => {
                      const found = prev.find((f) => f.id === id);
                      if (found?.preview) URL.revokeObjectURL(found.preview);
                      return prev.filter((f) => f.id !== id);
                    });
                  }}
                />
              ))}
            </div>
          ) : null}

          <div className="relative mb-1">
            <div className="max-h-96 w-full overflow-y-auto custom-scrollbar break-words transition-opacity duration-200 min-h-[2.5rem] pl-1">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full bg-transparent border-0 outline-none text-text-100 text-[16px] placeholder:text-text-400 resize-none overflow-hidden py-0 leading-relaxed block font-normal antialiased"
                rows={1}
                style={{ minHeight: "1.5em" }}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="flex gap-2 w-full items-center">
            <div className="relative flex-1 flex items-center shrink min-w-0 gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center relative shrink-0 transition-colors duration-200 h-8 w-8 rounded-lg active:scale-95 text-text-400 hover:text-text-200 hover:bg-bg-200"
                type="button"
                aria-label="Attach"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-row items-center min-w-0 gap-1">
              <div className="shrink-0 p-1 -m-1">
                <ModelSelector models={models} selectedModel={selectedModel} onSelect={setSelectedModel} />
              </div>

              <div>
                <button
                  onClick={handleSend}
                  disabled={!hasContent || disabled}
                  className={cn(
                    "inline-flex items-center justify-center relative shrink-0 transition-colors h-8 w-8 active:scale-95 rounded-xl",
                    hasContent ? "bg-accent text-bg-0 hover:bg-accent-hover shadow-md" : "bg-accent/30 text-bg-0/60 cursor-default",
                  )}
                  type="button"
                  aria-label="Send message"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isDragging ? (
        <div className="absolute inset-0 bg-bg-200/90 border-2 border-dashed border-accent rounded-2xl z-50 flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none">
          <p className="text-accent font-medium">Drop files to upload</p>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default ClaudeChatInput;

