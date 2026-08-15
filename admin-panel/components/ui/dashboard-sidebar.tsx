'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

export type NavItemData = {
  id: string;
  title: string;
  icon: React.ElementType;
  /** Where the item navigates. Omit for items that only run an action. */
  href?: string;
  /** Fired instead of navigation — used by Search to open the palette. */
  action?: string;
  badge?: number | string;
  shortcut?: string;
  children?: NavItemData[];
};

export type NavGroupData = {
  heading?: string;
  items: NavItemData[];
};

export interface BrandData {
  /** Shop name — the equivalent of the reference component's workspace. */
  name: string;
  /** Second line: live bot status, not a billing plan. */
  subtitle: string;
  initial: string;
  menu: Array<{ id: string; label: string; href?: string; action?: string; hint?: string }>;
}

/**
 * The workspace switcher from the reference, carrying Repli's actual identity:
 * the shop name, and underneath it the one status the owner checks first —
 * whether the bot is answering.
 */
function WorkspaceSwitcher({
  brand,
  onAction,
}: {
  brand: BrandData;
  onAction?: (action: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="group mb-4 flex w-full items-center justify-between rounded-lg px-2 py-2 transition-colors select-none hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-[6px] bg-sidebar-primary text-[13px] font-semibold text-sidebar-primary-foreground shadow-sm">
            {brand.initial}
          </div>
          <div className="flex flex-col overflow-hidden text-left">
            <span className="mb-1 max-w-[130px] truncate text-[13px] leading-none font-medium text-sidebar-accent-foreground">
              {brand.name}
            </span>
            <span className="text-[11px] leading-none text-sidebar-foreground/70">
              {brand.subtitle}
            </span>
          </div>
        </div>
        <ChevronDown
          className="size-4 shrink-0 text-sidebar-foreground/50 transition-colors group-hover:text-sidebar-accent-foreground/70"
          strokeWidth={1.5}
        />
      </button>

      {isOpen ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-[52px] left-0 z-50 flex w-full animate-in flex-col gap-0.5 rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-xl duration-100 fade-in zoom-in-95">
            {brand.menu.map((entry) => {
              const content = (
                <span className="flex items-center justify-between gap-2">
                  <span>{entry.label}</span>
                  {entry.hint ? (
                    <span className="text-[11px] text-muted-foreground">{entry.hint}</span>
                  ) : null}
                </span>
              );

              const className =
                'mx-1 cursor-pointer rounded-md px-3 py-2 text-[13px] text-foreground/80 transition-colors hover:bg-muted';

              return entry.href ? (
                <Link
                  key={entry.id}
                  href={entry.href}
                  onClick={() => setIsOpen(false)}
                  className={className}
                >
                  {content}
                </Link>
              ) : (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (entry.action) onAction?.(entry.action);
                  }}
                  className={cn(className, 'text-left')}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function NavItem({
  item,
  activeHref,
  onNavigate,
  onAction,
  level = 0,
}: {
  item: NavItemData;
  activeHref: string;
  onNavigate?: () => void;
  onAction?: (action: string) => void;
  level?: number;
}) {
  const hasChildren = !!item.children?.length;

  const isSelf = item.href ? isActiveHref(activeHref, item.href) : false;
  const childActive = hasChildren
    ? item.children!.some((child) => (child.href ? isActiveHref(activeHref, child.href) : false))
    : false;
  const isActive = isSelf || (!hasChildren && false);

  // A section opens itself when you are already inside it.
  const [isOpen, setIsOpen] = useState(childActive || isSelf);
  useEffect(() => {
    if (childActive || isSelf) setIsOpen(true);
  }, [childActive, isSelf]);

  const rowClass = cn(
    'group flex items-center justify-between rounded-[6px] px-2.5 py-[7px] transition-all duration-200 select-none',
    isActive || (hasChildren && (childActive || isSelf))
      ? 'bg-white/10 font-medium text-sidebar-accent-foreground'
      : 'text-sidebar-foreground hover:bg-white/5 hover:text-sidebar-accent-foreground/90'
  );

  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <item.icon
          className={cn(
            'size-4 transition-colors',
            isActive || childActive
              ? 'text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground/70'
          )}
          strokeWidth={1.5}
        />
        <span className="truncate text-[13px] tracking-wide">{item.title}</span>
      </div>

      <div className="flex items-center gap-2">
        {item.shortcut ? (
          <kbd className="hidden h-5 items-center justify-center rounded-[4px] border border-sidebar-border px-1.5 font-mono text-[10px] font-medium text-sidebar-foreground/70 group-hover:inline-flex">
            {item.shortcut}
          </kbd>
        ) : null}
        {item.badge ? (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-[10px] font-semibold text-sidebar-primary-foreground">
            {item.badge}
          </span>
        ) : null}
        {hasChildren ? (
          <ChevronRight
            className={cn(
              'size-3.5 text-sidebar-foreground/50 transition-transform duration-200',
              isOpen && 'rotate-90'
            )}
            strokeWidth={2}
          />
        ) : null}
      </div>
    </>
  );

  const style = { paddingLeft: `${level * 12 + 10}px` };

  return (
    <div className="flex w-full flex-col">
      {hasChildren ? (
        <button
          type="button"
          className={cn(rowClass, 'w-full text-left')}
          style={style}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
        >
          {body}
        </button>
      ) : item.href ? (
        <Link
          href={item.href}
          className={rowClass}
          style={style}
          onClick={onNavigate}
          aria-current={isActive ? 'page' : undefined}
        >
          {body}
        </Link>
      ) : (
        <button
          type="button"
          className={cn(rowClass, 'w-full text-left')}
          style={style}
          onClick={() => item.action && onAction?.(item.action)}
        >
          {body}
        </button>
      )}

      {hasChildren ? (
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out',
            isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="relative mt-0.5 flex min-h-0 flex-col gap-0.5 overflow-hidden">
            <div
              className="absolute top-0 bottom-0 border-l border-white/10"
              style={{ left: `${level * 12 + 17.5}px` }}
            />
            {item.children!.map((child) => (
              <NavItem
                key={child.id}
                item={child}
                activeHref={activeHref}
                onNavigate={onNavigate}
                onAction={onAction}
                level={level + 1}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A child link like `/admin/orders?status=CONFIRMED` must only light up when
 * that filter is actually applied, while `/admin/orders` stays active for the
 * whole section — so the query string is part of the comparison.
 */
function isActiveHref(current: string, href: string): boolean {
  const [path, query] = href.split('?');
  const [currentPath, currentQuery] = current.split('?');

  if (!path || currentPath !== path) {
    return Boolean(path && currentPath?.startsWith(`${path}/`) && !query);
  }
  if (!query) return !currentQuery;

  const wanted = new URLSearchParams(query);
  const actual = new URLSearchParams(currentQuery ?? '');
  for (const [key, value] of wanted) {
    if (actual.get(key) !== value) return false;
  }
  return true;
}

export function SidebarNav({
  className = '',
  brand,
  groups,
  bottomItems,
  activeHref,
  onNavigate,
  onAction,
}: {
  className?: string;
  brand: BrandData;
  groups: NavGroupData[];
  bottomItems: NavItemData[];
  activeHref: string;
  onNavigate?: () => void;
  onAction?: (action: string) => void;
}) {
  return (
    <div
      className={cn(
        'flex h-full w-[260px] flex-col bg-sidebar p-3 font-sans text-sidebar-foreground',
        className
      )}
    >
      <WorkspaceSwitcher brand={brand} onAction={onAction} />

      <div className="scrollbar-thin mt-2 flex flex-1 flex-col gap-4 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.map((group, index) => (
          <div key={group.heading ?? index} className="flex flex-col gap-0.5">
            {group.heading ? (
              <span className="mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">
                {group.heading}
              </span>
            ) : null}
            {group.items.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                activeHref={activeHref}
                onNavigate={onNavigate}
                onAction={onAction}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-sidebar-border pt-4">
        {bottomItems.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            activeHref={activeHref}
            onNavigate={onNavigate}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
}
