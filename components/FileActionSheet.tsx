"use client";

import { FaCopy, FaTrash, FaTimes } from "react-icons/fa";
import { FileNode } from "@/types";

export default function FileActionSheet({
  node,
  onClose,
  onDuplicate,
  onDelete,
}: {
  node: FileNode;
  onClose: () => void;
  onDuplicate: (node: FileNode) => void;
  onDelete: (node: FileNode) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[996] flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-panel p-2 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm text-gray-400 truncate">{node.path}</span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 shrink-0 ml-2">
            <FaTimes size={14} />
          </button>
        </div>

        <button
          onClick={() => {
            onClose();
            onDuplicate(node);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-white/5 active:bg-white/10"
        >
          <FaCopy className="text-accent" />
          Duplikasi
        </button>

        <button
          onClick={() => {
            onClose();
            onDelete(node);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg hover:bg-white/5 active:bg-white/10 text-red-400"
        >
          <FaTrash />
          Hapus
        </button>
      </div>
    </div>
  );
}
