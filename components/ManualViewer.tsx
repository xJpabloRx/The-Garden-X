"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { Search, ChevronDown, ChevronRight, BookOpen, X } from "lucide-react";
import { Card } from "@/components/ui/Card";

type ManualSection = {
  id: string;
  title: string;
  content: ManualBlock[];
};

type ManualBlock =
  | { type: "text"; text: string }
  | { type: "step"; number: number; text: string }
  | { type: "tip"; text: string }
  | { type: "warning"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; items: string[] }
  | { type: "subtitle"; text: string };

/* ═══════════════════════════════════════════════════════════
   CLIENT MANUAL CONTENT
   ═══════════════════════════════════════════════════════════ */
const CLIENT_SECTIONS: ManualSection[] = [
  {
    id: "login", title: "Logging In",
    content: [
      { type: "text", text: "To access the client portal, you need the credentials provided by your administrator." },
      { type: "step", number: 1, text: "Open your browser and go to the portal URL provided by your admin." },
      { type: "step", number: 2, text: "Enter your email address and password." },
      { type: "step", number: 3, text: "Click \"Sign In\" to access the dashboard." },
      { type: "tip", text: "If you forgot your password, contact your administrator to reset it." },
      { type: "subtitle", text: "Navigation" },
      { type: "text", text: "Once logged in, you'll see a sidebar on the left (or a menu icon ☰ on mobile) with all available sections." },
      { type: "table", headers: ["Section", "Description"], rows: [
        ["Shipments", "View your flower shipments and coordination details"],
        ["Inventory", "Track your available stock, sold items, and box contents"],
        ["Sales", "View all your sales history"],
        ["Sell", "Create sell orders to your buyers"],
        ["Clients", "Manage your buyers (customers)"],
        ["Orders", "Place new flower orders to the farm"],
        ["QR Scanner", "Scan QR codes on your boxes to view contents"],
      ]},
    ],
  },
  {
    id: "shipments", title: "Shipments",
    content: [
      { type: "text", text: "The Shipments page is your main dashboard. Here you can see all your flower shipments from the farm." },
      { type: "subtitle", text: "Viewing Shipments" },
      { type: "step", number: 1, text: "Each shipment card shows: Client name, HAWB, AWB, Origin → Destination, and Status." },
      { type: "step", number: 2, text: "Click on a shipment card to expand it and see the box details (what each box contains)." },
      { type: "subtitle", text: "Moving to Inventory" },
      { type: "text", text: "When a shipment arrives, you can move it to your inventory:" },
      { type: "step", number: 1, text: "Find the shipment you received." },
      { type: "step", number: 2, text: "Click the \"Move to Inventory\" button." },
      { type: "step", number: 3, text: "Confirm the action. The boxes will now appear in your Inventory section." },
      { type: "warning", text: "Once moved to inventory, this action cannot be undone. The button will be disabled to prevent duplicates across devices." },
    ],
  },
  {
    id: "inventory", title: "Inventory",
    content: [
      { type: "text", text: "The Inventory page shows all your available flower stock organized in two views." },
      { type: "subtitle", text: "Stats Overview" },
      { type: "list", items: [
        "Available — Total units available for sale",
        "Sold — Total units already sold",
        "Boxes — Total number of boxes in inventory",
      ]},
      { type: "subtitle", text: "Stock Summary" },
      { type: "step", number: 1, text: "Click \"Stock Summary\" to see all products grouped by variety." },
      { type: "step", number: 2, text: "Use the search bar to filter by variety name or color." },
      { type: "step", number: 3, text: "Each row shows: Variety, Type, Color, Stem Length, Total, Available, and Sold." },
      { type: "step", number: 4, text: "Click \"Sell\" on any row to sell directly from stock summary." },
      { type: "subtitle", text: "By Shipment" },
      { type: "step", number: 1, text: "Click \"By Shipment\" to see inventory organized by shipment." },
      { type: "step", number: 2, text: "Click on a shipment to expand and see individual boxes." },
      { type: "subtitle", text: "Selling from Inventory" },
      { type: "step", number: 1, text: "Click \"Sell\" on any product or box." },
      { type: "step", number: 2, text: "Enter the quantity, buyer name, and optional notes." },
      { type: "step", number: 3, text: "Toggle \"Paid\" if the buyer has already paid." },
      { type: "step", number: 4, text: "Click \"Confirm Sale\" to complete." },
      { type: "tip", text: "When selling from Stock Summary, you'll need to select which specific box to deduct from." },
      { type: "subtitle", text: "Credits" },
      { type: "text", text: "If flowers are damaged or unsold, you can register a credit:" },
      { type: "step", number: 1, text: "Click \"Credit\" on a product in the By Shipment view." },
      { type: "step", number: 2, text: "Enter quantity, select a reason (Damaged, Unsold, Expired, Other), and add notes." },
      { type: "step", number: 3, text: "Click \"Confirm\". Credits reduce available inventory." },
    ],
  },
  {
    id: "sales", title: "Sales",
    content: [
      { type: "text", text: "The Sales page shows a complete history of all your sales." },
      { type: "subtitle", text: "Viewing Sales" },
      { type: "step", number: 1, text: "Each sale shows: Variety, Type, Quantity, Buyer, Date, and Payment status." },
      { type: "step", number: 2, text: "Use filters to search by variety, buyer, or date." },
      { type: "subtitle", text: "Managing Sales" },
      { type: "list", items: [
        "Mark as Paid — Toggle the payment status of a sale.",
        "Return — Mark a sale as returned (sets a return flag, does NOT restore inventory).",
        "Restore — Deletes the sale entirely and frees the inventory back to available.",
      ]},
      { type: "warning", text: "Return only marks the sale as returned. Only \"Restore\" (delete) actually frees the inventory units back to available stock." },
    ],
  },
  {
    id: "sell", title: "Sell Orders",
    content: [
      { type: "text", text: "Sell Orders let you create complete orders for your buyers, selecting multiple products from your inventory." },
      { type: "subtitle", text: "Creating a Sell Order" },
      { type: "step", number: 1, text: "Click \"New Sell Order\"." },
      { type: "step", number: 2, text: "Select a Buyer from the dropdown (or type a name for a one-time buyer)." },
      { type: "step", number: 3, text: "Search and add products from your inventory. For each product select the variety, choose which box to deduct from, and set the quantity." },
      { type: "step", number: 4, text: "Add as many products as needed to the order." },
      { type: "step", number: 5, text: "Toggle \"Paid\" if applicable." },
      { type: "step", number: 6, text: "Click \"Submit Order\" to confirm." },
      { type: "tip", text: "The system automatically prioritizes boxes with the most available stock when suggesting which box to deduct from." },
    ],
  },
  {
    id: "clients", title: "Clients (Buyers)",
    content: [
      { type: "text", text: "Manage your buyers — the people or businesses you sell flowers to." },
      { type: "subtitle", text: "Adding a Buyer" },
      { type: "step", number: 1, text: "Click \"Add Buyer\"." },
      { type: "step", number: 2, text: "Fill in: Name (required), Address, Phone, Email, Notes." },
      { type: "step", number: 3, text: "Click \"Save\"." },
      { type: "subtitle", text: "Editing / Deleting" },
      { type: "step", number: 1, text: "Click on a buyer to see their details." },
      { type: "step", number: 2, text: "Click \"Edit\" to modify or \"Delete\" to remove." },
    ],
  },
  {
    id: "orders", title: "Orders",
    content: [
      { type: "text", text: "Orders allow you to reserve flowers from the farm for future shipments." },
      { type: "subtitle", text: "Creating an Order" },
      { type: "step", number: 1, text: "Click \"Create Order\" to open the order form." },
      { type: "step", number: 2, text: "Select a Farm Departure Date (minimum 2 days from today)." },
      { type: "step", number: 3, text: "Click \"Add Box\" to add boxes to your order." },
      { type: "subtitle", text: "Solid Mode" },
      { type: "text", text: "All flowers in the box are the same type." },
      { type: "step", number: 1, text: "Choose Bouquet (25×12 stems) or Bonche (12×25 stems)." },
      { type: "step", number: 2, text: "Select category: Color or Red." },
      { type: "step", number: 3, text: "For Bonche: optionally select a specific variety." },
      { type: "step", number: 4, text: "Set number of boxes and stem length." },
      { type: "subtitle", text: "Personalized Mode" },
      { type: "text", text: "Mix different varieties. Always bonche format." },
      { type: "step", number: 1, text: "Click \"Add varieties\" to open the variety picker." },
      { type: "step", number: 2, text: "Search and set quantity of bonches for each variety." },
      { type: "step", number: 3, text: "The system auto-distributes into boxes of 12 bonches." },
      { type: "step", number: 4, text: "Click \"Edit boxes\" to manually adjust the distribution." },
      { type: "warning", text: "Each box must have exactly 12 bonches. Incomplete boxes block submission." },
      { type: "subtitle", text: "Order Status" },
      { type: "table", headers: ["Status", "Meaning"], rows: [
        ["Pending", "Order submitted, waiting for admin review"],
        ["Confirmed", "Admin has confirmed your order"],
        ["Processing", "Order is being prepared at the farm"],
        ["Completed", "Order has been shipped"],
        ["Cancelled", "Order was cancelled"],
      ]},
    ],
  },
  {
    id: "qr", title: "QR Scanner",
    content: [
      { type: "text", text: "Scan QR codes on your boxes to quickly check their contents." },
      { type: "subtitle", text: "Scanning with Camera" },
      { type: "step", number: 1, text: "Click \"Open Camera\"." },
      { type: "step", number: 2, text: "Allow camera access when prompted." },
      { type: "step", number: 3, text: "Point your camera at the QR code. The scanner detects it automatically." },
      { type: "subtitle", text: "Upload or Paste" },
      { type: "step", number: 1, text: "Click \"Upload Image\" to scan from a photo." },
      { type: "step", number: 2, text: "Or paste the token text directly and click \"Decode\"." },
      { type: "subtitle", text: "Results" },
      { type: "list", items: [
        "Box Details — Box number, title, and each product (type, variety, quantity, stem length, color).",
        "Order Details (collapsible) — Client, Date, HAWB, AWB, Origin, Destination, DAE, HBs.",
      ]},
      { type: "warning", text: "You can only scan QR codes that belong to your account." },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
   ADMIN MANUAL CONTENT
   ═══════════════════════════════════════════════════════════ */
const ADMIN_SECTIONS: ManualSection[] = [
  {
    id: "login", title: "Logging In as Admin",
    content: [
      { type: "text", text: "Admin accounts have full access to manage all clients, shipments, orders, and varieties." },
      { type: "step", number: 1, text: "Go to the portal URL in your browser." },
      { type: "step", number: 2, text: "Enter your admin email and password." },
      { type: "step", number: 3, text: "Click \"Sign In\"." },
      { type: "text", text: "After logging in, you'll see the Admin Panel label and a purple Admin badge." },
    ],
  },
  {
    id: "overview", title: "Admin Panel Overview",
    content: [
      { type: "table", headers: ["Section", "Description"], rows: [
        ["Shipments", "Create and manage flower shipments for all clients"],
        ["Orders", "Review and process client orders"],
        ["Clients", "Create client accounts and manage access"],
        ["Varieties", "Manage the flower variety catalog"],
      ]},
      { type: "tip", text: "The collapsible \"Client View\" section lets you access the same pages clients see for testing." },
    ],
  },
  {
    id: "shipments", title: "Shipments Management",
    content: [
      { type: "subtitle", text: "Creating a Shipment" },
      { type: "step", number: 1, text: "Click \"New Shipment\"." },
      { type: "step", number: 2, text: "Fill in: Client, HAWB, AWB, Origin, Destination, DAE, HBs, Departure Date, Estimated Arrival." },
      { type: "step", number: 3, text: "Click \"Save\" to create the shipment." },
      { type: "subtitle", text: "Managing Boxes" },
      { type: "step", number: 1, text: "Click on a shipment to expand it." },
      { type: "step", number: 2, text: "Click \"Edit\" on any box." },
      { type: "step", number: 3, text: "For each product: set Type (Bouquet/Bonche), Variety, Quantity, Stem Length, Color." },
      { type: "step", number: 4, text: "Click \"+ Add Product\" for more products in the same box." },
      { type: "step", number: 5, text: "Click \"Save\"." },
      { type: "subtitle", text: "Bulk Edit" },
      { type: "step", number: 1, text: "Check the boxes you want to edit." },
      { type: "step", number: 2, text: "Click \"Bulk Edit\"." },
      { type: "step", number: 3, text: "Configure products — applies to ALL selected boxes." },
      { type: "step", number: 4, text: "Click \"Save All\"." },
      { type: "subtitle", text: "CSV Upload" },
      { type: "step", number: 1, text: "Click \"Upload CSV\"." },
      { type: "step", number: 2, text: "Select your CSV file matching the template format." },
      { type: "tip", text: "Click \"Download Template\" to get a sample CSV with the correct columns." },
      { type: "table", headers: ["Column", "Example"], rows: [
        ["hawb", "HAWB123"],
        ["caja", "1"],
        ["tipo", "bouquet"],
        ["variedad", "Freedom"],
        ["cantidad", "12"],
        ["stem_length", "60cm"],
        ["color", "Red"],
      ]},
    ],
  },
  {
    id: "orders", title: "Orders Management",
    content: [
      { type: "text", text: "Review, confirm, and manage all client orders." },
      { type: "subtitle", text: "Stats" },
      { type: "list", items: [
        "Total Orders — All orders across all clients",
        "Pending — Orders waiting for your review",
        "Confirmed — Orders you've confirmed",
        "Total Boxes — Sum of all boxes across all orders",
      ]},
      { type: "subtitle", text: "Filtering" },
      { type: "step", number: 1, text: "Use the search bar to find orders by client name, date, or ID." },
      { type: "step", number: 2, text: "Use the status filter dropdown to show specific statuses." },
      { type: "subtitle", text: "Reviewing an Order" },
      { type: "step", number: 1, text: "Click on an order to expand its details." },
      { type: "step", number: 2, text: "You'll see: client name, status buttons, order summary, item details." },
      { type: "subtitle", text: "Changing Status" },
      { type: "table", headers: ["Status", "When to Use"], rows: [
        ["Pending", "Default — just submitted by client"],
        ["Confirmed", "You've reviewed and accepted the order"],
        ["Processing", "Being prepared at the farm"],
        ["Completed", "Order has been shipped"],
        ["Cancelled", "Order was cancelled"],
      ]},
      { type: "subtitle", text: "Admin Notes" },
      { type: "step", number: 1, text: "In the expanded order, click \"Edit\" in the Notes section." },
      { type: "step", number: 2, text: "Add or modify notes, then click \"Save\"." },
      { type: "subtitle", text: "Deleting" },
      { type: "step", number: 1, text: "Click \"Delete order\" at the bottom." },
      { type: "step", number: 2, text: "Confirm to permanently delete the order and all items." },
      { type: "warning", text: "Deleting an order is permanent and cannot be undone." },
    ],
  },
  {
    id: "clients", title: "Clients Management",
    content: [
      { type: "text", text: "Create and manage client accounts that can access the portal." },
      { type: "subtitle", text: "Creating a Client" },
      { type: "step", number: 1, text: "Click \"New Client\"." },
      { type: "step", number: 2, text: "Fill in: Name, Company, Email (login), Username, Password." },
      { type: "step", number: 3, text: "Click \"Create\"." },
      { type: "tip", text: "The email and password you set are what the client uses to log in. Share credentials securely." },
      { type: "subtitle", text: "Managing Clients" },
      { type: "list", items: [
        "Active/Inactive — Toggle access. Inactive clients cannot log in.",
        "Edit — Modify client information.",
      ]},
    ],
  },
  {
    id: "varieties", title: "Varieties Management",
    content: [
      { type: "text", text: "Manage the flower variety catalog used by clients when placing orders." },
      { type: "subtitle", text: "Adding a Variety" },
      { type: "step", number: 1, text: "Click \"Add Variety\"." },
      { type: "step", number: 2, text: "Enter: Name (e.g., Freedom, Vendela) and Color (e.g., Red, White)." },
      { type: "step", number: 3, text: "Click \"Save\"." },
      { type: "subtitle", text: "CSV Upload" },
      { type: "step", number: 1, text: "Click \"Upload CSV\"." },
      { type: "step", number: 2, text: "Select CSV with columns: nombre, color." },
      { type: "tip", text: "Deactivating a variety hides it from client order forms without deleting it." },
    ],
  },
  {
    id: "clientview", title: "Client View",
    content: [
      { type: "text", text: "The sidebar includes a collapsible \"Client View\" section giving you access to the same pages clients see." },
      { type: "step", number: 1, text: "Click \"Client View\" in the sidebar to expand it." },
      { type: "step", number: 2, text: "Click any section to view it as a client would." },
      { type: "tip", text: "Use Client View to test the portal, verify shipments, or troubleshoot client issues." },
      { type: "warning", text: "Actions in Client View affect real data. Use with caution." },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
   BLOCK RENDERER
   ═══════════════════════════════════════════════════════════ */
function Block({ block }: { block: ManualBlock }) {
  switch (block.type) {
    case "text":
      return <p className="text-sm text-gray-300 leading-relaxed">{block.text}</p>;
    case "step":
      return (
        <div className="flex gap-3 items-start bg-white/2 border-l-2 border-cyan-400/40 rounded-r-lg px-3 py-2.5">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center">{block.number}</span>
          <span className="text-sm text-gray-200">{block.text}</span>
        </div>
      );
    case "tip":
      return (
        <div className="flex gap-2 items-start bg-green-400/5 border-l-2 border-green-400/40 rounded-r-lg px-3 py-2.5">
          <span className="text-green-400 text-xs font-bold flex-shrink-0 mt-0.5">💡 Tip:</span>
          <span className="text-sm text-green-300/90">{block.text}</span>
        </div>
      );
    case "warning":
      return (
        <div className="flex gap-2 items-start bg-amber-400/5 border-l-2 border-amber-400/40 rounded-r-lg px-3 py-2.5">
          <span className="text-amber-400 text-xs font-bold flex-shrink-0 mt-0.5">⚠️</span>
          <span className="text-sm text-amber-300/90">{block.text}</span>
        </div>
      );
    case "subtitle":
      return <h4 className="text-sm font-semibold text-purple-400 pt-2">{block.text}</h4>;
    case "list":
      return (
        <ul className="space-y-1 pl-4">
          {block.items.map((item, i) => (
            <li key={i} className="text-sm text-gray-300 list-disc">{item}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5">
                {block.headers.map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 text-xs text-dim uppercase tracking-wider font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-gray-300">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function ManualViewer({ isAdmin }: { isAdmin: boolean }) {
  const sections = isAdmin ? ADMIN_SECTIONS : CLIENT_SECTIONS;
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Filter sections by search
  const filtered = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.toLowerCase();
    return sections.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.content.some(b => {
        if ("text" in b && typeof b.text === "string") return b.text.toLowerCase().includes(q);
        if ("items" in b && Array.isArray(b.items)) return b.items.some(i => i.toLowerCase().includes(q));
        return false;
      })
    );
  }, [search, sections]);

  // Auto-expand first result when searching
  useEffect(() => {
    if (search.trim() && filtered.length > 0) {
      setExpanded(filtered[0].id);
    }
  }, [search, filtered]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-3">
          <BookOpen size={24} className="text-cyan-400" />
          {isAdmin ? "Admin Manual" : "User Manual"}
        </h1>
        <p className="text-dim text-sm mt-1">
          {isAdmin ? "How to manage shipments, orders, clients, and varieties" : "How to use the client portal"}
        </p>
      </div>

      {/* Search */}
      <Card className="p-0">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search manual..."
            className="w-full pl-11 pr-10 py-3.5 bg-transparent text-sm text-white focus:outline-none placeholder:text-dim" />
          {search && (
            <button onClick={() => { setSearch(""); setExpanded(null); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-white p-1">
              <X size={14} />
            </button>
          )}
        </div>
      </Card>

      {/* Table of contents (when not searching) */}
      {!search.trim() && (
        <Card>
          <p className="text-xs text-dim uppercase tracking-wider mb-3">Quick Navigation</p>
          <div className="flex flex-wrap gap-2">
            {sections.map(s => (
              <button key={s.id} onClick={() => { setExpanded(expanded === s.id ? null : s.id); }}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  expanded === s.id
                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                    : "text-dim border-white/10 hover:text-white hover:border-white/20"
                }`}>
                {s.title}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Sections */}
      {filtered.length === 0 && (
        <p className="text-dim text-sm text-center py-8">No results found for &quot;{search}&quot;</p>
      )}

      <div className="space-y-2">
        {filtered.map(section => {
          const isOpen = expanded === section.id;
          return (
            <Card key={section.id} className="p-0 overflow-hidden">
              <button type="button" onClick={() => setExpanded(isOpen ? null : section.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/2 transition-colors text-left">
                {isOpen
                  ? <ChevronDown size={16} className="text-cyan-400 flex-shrink-0" />
                  : <ChevronRight size={16} className="text-dim flex-shrink-0" />}
                <span className="text-sm font-semibold text-white">{section.title}</span>
                <span className="text-xs text-dim ml-auto">{section.content.filter(b => b.type === "step").length} steps</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3 animate-fade-in">
                  {section.content.map((block, i) => (
                    <Block key={i} block={block} />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
