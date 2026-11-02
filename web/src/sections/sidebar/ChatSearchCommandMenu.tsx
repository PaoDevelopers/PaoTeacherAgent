"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { Route } from "next";
import { useAppPosition } from "@/lib/position/hooks";
import CommandMenu, {
  useCommandMenuContext,
} from "@/refresh-components/commandmenu/CommandMenu";
import { timeAgo } from "@opal/time";
import { highlightMatch } from "@/lib/sidebar/utils";
import Text from "@/refresh-components/texts/Text";
import useChatSearchOptimistic from "@/lib/sidebar/hooks";
import {
  SvgEditBig,
  SvgBubbleText,
  SvgArrowUpDown,
  SvgKeystroke,
} from "@opal/icons";
import TextSeparator from "@/refresh-components/TextSeparator";

/**
 * Dynamic footer that shows contextual action labels based on highlighted item type
 */
function DynamicFooter() {
  const t = useTranslations("sidebar");
  const { highlightedItemType } = useCommandMenuContext();

  // "Show all" for filters, "Open" for everything else (items, actions, or no highlight)
  const actionLabel =
    highlightedItemType === "filter"
      ? t("chatSearch.footer.showAllAction.label")
      : t("chatSearch.footer.openAction.label");

  return (
    <CommandMenu.Footer
      leftActions={
        <>
          <CommandMenu.FooterAction
            icon={SvgArrowUpDown}
            label={t("chatSearch.footer.selectAction.label")}
          />
          <CommandMenu.FooterAction icon={SvgKeystroke} label={actionLabel} />
        </>
      }
    />
  );
}

interface ChatSearchCommandMenuProps {
  /** Renders the control that opens the menu. `isOpen` lets it show a selected state. */
  trigger: (open: () => void, isOpen: boolean) => React.ReactNode;
}

export default function ChatSearchCommandMenu({
  trigger,
}: ChatSearchCommandMenuProps) {
  const t = useTranslations("sidebar");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "chats">("all");
  const appPosition = useAppPosition();
  const router = useRouter();

  // Constants for preview limits
  const PREVIEW_CHATS_LIMIT = 4;

  // Determine if we should enable optimistic search (when searching or viewing chats filter)
  const shouldUseOptimisticSearch =
    searchValue.trim().length > 0 || activeFilter === "chats";

  // Use optimistic search hook for chat sessions (includes fallback from useChatSessions)
  const {
    results: filteredChats,
    isSearching,
    hasMore,
    isLoadingMore,
    sentinelRef,
  } = useChatSearchOptimistic({
    searchQuery: searchValue,
    enabled: shouldUseOptimisticSearch,
  });

  // Compute displayed items based on filter state
  const displayedChats = useMemo(() => {
    if (activeFilter === "all" && !searchValue.trim()) {
      return filteredChats.slice(0, PREVIEW_CHATS_LIMIT);
    }
    return filteredChats;
  }, [filteredChats, activeFilter, searchValue]);

  // Header filters for showing active filter as a chip
  const headerFilters = useMemo(() => {
    if (activeFilter === "chats") {
      return [{ id: "chats", label: t("chatSearch.sessionsFilter.label") }];
    }
    return [];
  }, [activeFilter, t]);

  const handleFilterRemove = useCallback(() => {
    setActiveFilter("all");
  }, []);

  // Navigation handlers
  const handleNewSession = useCallback(() => {
    router.push("/app");
    setOpen(false);
  }, [router]);

  const handleChatSelect = useCallback(
    (chatId: string) => {
      appPosition.openChat(chatId);
      setOpen(false);
    },
    [appPosition]
  );

  const handleOpen = useCallback(() => setOpen(true), []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSearchValue("");
      setActiveFilter("all");
    }
  }, []);

  const handleEmptyBackspace = useCallback(() => {
    if (activeFilter !== "all") {
      // Remove active filter, return to root menu
      setActiveFilter("all");
    } else {
      // No filter active, close the menu
      setOpen(false);
    }
  }, [activeFilter]);

  const hasSearchValue = searchValue.trim().length > 0;

  return (
    <>
      {trigger(handleOpen, open)}

      <CommandMenu open={open} onOpenChange={handleOpenChange}>
        <CommandMenu.Content>
          <CommandMenu.Header
            placeholder={t("chatSearch.searchInput.placeholder")}
            value={searchValue}
            onValueChange={setSearchValue}
            filters={headerFilters}
            onFilterRemove={handleFilterRemove}
            onClose={() => setOpen(false)}
            onEmptyBackspace={handleEmptyBackspace}
          />

          <CommandMenu.List
            emptyMessage={
              hasSearchValue
                ? t("chatSearch.list.noResults.text")
                : t("chatSearch.list.empty.text")
            }
          >
            {/* New Session action - always visible in "all" filter, even during search */}
            {activeFilter === "all" && (
              <CommandMenu.Action
                value="new-session"
                icon={SvgEditBig}
                onSelect={handleNewSession}
                defaultHighlight={!hasSearchValue}
              >
                {t("chatSearch.newSession.label")}
              </CommandMenu.Action>
            )}

            {/* Recent Sessions section - show if filter is 'all' or 'chats' */}
            {(activeFilter === "all" || activeFilter === "chats") &&
              displayedChats.length > 0 && (
                <>
                  {searchValue.trim().length === 0 && (
                    <CommandMenu.Filter
                      value="recent-sessions"
                      onSelect={() => setActiveFilter("chats")}
                      isApplied={
                        activeFilter === "chats" ||
                        filteredChats.length <= PREVIEW_CHATS_LIMIT
                      }
                    >
                      {activeFilter === "chats"
                        ? t("chatSearch.recentFilter.label")
                        : t("chatSearch.recentSessionsFilter.label")}
                    </CommandMenu.Filter>
                  )}
                  {displayedChats.map((chat) => (
                    <CommandMenu.Item
                      key={chat.id}
                      value={`chat-${chat.id}`}
                      icon={SvgBubbleText}
                      rightContent={({ isHighlighted }) =>
                        isHighlighted ? (
                          <Text figureKeystroke text02>
                            ↵
                          </Text>
                        ) : (
                          <Text
                            secondaryBody
                            text03
                            data-testid="command-menu-timestamp"
                          >
                            {timeAgo(chat.time, locale)}
                          </Text>
                        )
                      }
                      onSelect={() => handleChatSelect(chat.id)}
                    >
                      {highlightMatch(chat.label, searchValue)}
                    </CommandMenu.Item>
                  ))}
                  {/* Infinite scroll sentinel and loading indicator for chats */}
                  {activeFilter === "chats" && hasMore && (
                    <div ref={sentinelRef} className="h-1" aria-hidden="true" />
                  )}
                  {activeFilter === "chats" &&
                    (isLoadingMore || isSearching) && (
                      <div className="flex justify-center items-center py-3">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-text-04 border-t-text-02" />
                      </div>
                    )}
                </>
              )}

            {/* No more results divider - shown when no results for the active filter */}
            {displayedChats.length === 0 && (
              <TextSeparator
                text={t("chatSearch.noMoreResults.text")}
                className="mt-auto mb-2"
              />
            )}
          </CommandMenu.List>

          <DynamicFooter />
        </CommandMenu.Content>
      </CommandMenu>
    </>
  );
}
