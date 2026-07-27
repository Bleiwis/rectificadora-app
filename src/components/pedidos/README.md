# Pedidos Component Architecture

This folder follows an Atomic Design style split for the Pedidos feature.

## Layers

- atoms: smallest reusable building blocks
- molecules: composed UI groups that combine atoms and form controls
- organisms: full feature sections with business display behavior
- models: shared TypeScript interfaces and domain types

## Entry Points

- Use [index.ts](index.ts) as the primary import surface.
- Legacy file paths are kept as passthrough exports for backward compatibility.

## Current Mapping

- atoms/ActionIconButton.tsx
- molecules/PedidosFilters.tsx
- molecules/PedidosPagination.tsx
- organisms/PedidosTable.tsx
- organisms/OrderDetailModal.tsx
- models/types.ts
