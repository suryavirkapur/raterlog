import { j as Route$2 } from './router-bujGOfVM.mjs';
import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { Text, Flex, Box, Heading, Code, Button, Separator, Card, Badge, ScrollArea, Table } from '@radix-ui/themes';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line, PieChart, Pie, Cell } from 'recharts';
import '../virtual/entry.mjs';
import '../nitro/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import '@tanstack/react-router/ssr/server';
import 'node:async_hooks';
import 'rou3';
import 'srvx';
import '@tanstack/router-core';
import '@tanstack/router-core/ssr/client';
import 'seroval';
import '@tanstack/history';
import '@tanstack/router-core/ssr/server';

var API_URL = "http://localhost:8080";
var COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899"
];
var formatTimestamp = (ts) => {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
};
function LogCard({ log, icon, idx }) {
  const [open, setOpen] = useState(false);
  let parsedMeta = [];
  if (log.metadata) try {
    const obj = JSON.parse(log.metadata);
    parsedMeta = Object.entries(obj).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)]);
  } catch {
    parsedMeta = [["raw", log.metadata]];
  }
  const hasMeta = parsedMeta.length > 0;
  return /* @__PURE__ */ jsx(Card, {
    size: "2",
    style: {
      background: "var(--gray-a2)",
      cursor: hasMeta ? "pointer" : "default"
    },
    onClick: () => hasMeta && setOpen(!open),
    children: /* @__PURE__ */ jsxs(Flex, {
      direction: "column",
      gap: "2",
      children: [/* @__PURE__ */ jsxs(Flex, {
        align: "center",
        justify: "between",
        children: [/* @__PURE__ */ jsxs(Flex, {
          align: "center",
          gap: "3",
          children: [/* @__PURE__ */ jsx(Text, {
            size: "4",
            children: icon
          }), /* @__PURE__ */ jsxs(Flex, {
            direction: "column",
            gap: "1",
            children: [/* @__PURE__ */ jsxs(Flex, {
              align: "center",
              gap: "2",
              children: [/* @__PURE__ */ jsx(Text, {
                weight: "bold",
                size: "2",
                children: log.event_name
              }), hasMeta && /* @__PURE__ */ jsxs(Badge, {
                size: "1",
                variant: "soft",
                color: open ? "blue" : "gray",
                children: [
                  parsedMeta.length,
                  " ",
                  parsedMeta.length === 1 ? "field" : "fields",
                  " ",
                  open ? "\u25B2" : "\u25BC"
                ]
              })]
            }), /* @__PURE__ */ jsx(Text, {
              size: "1",
              color: "gray",
              children: log.event_payload
            })]
          })]
        }), /* @__PURE__ */ jsx(Text, {
          size: "1",
          color: "gray",
          style: { whiteSpace: "nowrap" },
          children: formatTimestamp(log.timestamp)
        })]
      }), open && hasMeta && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Separator, { size: "4" }), /* @__PURE__ */ jsx(Box, { children: /* @__PURE__ */ jsxs(Table.Root, {
        size: "1",
        variant: "surface",
        children: [/* @__PURE__ */ jsx(Table.Header, { children: /* @__PURE__ */ jsxs(Table.Row, { children: [/* @__PURE__ */ jsx(Table.ColumnHeaderCell, {
          style: { width: "35%" },
          children: "Key"
        }), /* @__PURE__ */ jsx(Table.ColumnHeaderCell, { children: "Value" })] }) }), /* @__PURE__ */ jsx(Table.Body, { children: parsedMeta.map(([key, value]) => /* @__PURE__ */ jsxs(Table.Row, { children: [/* @__PURE__ */ jsx(Table.Cell, { children: /* @__PURE__ */ jsx(Text, {
          size: "1",
          weight: "bold",
          color: "blue",
          children: key
        }) }), /* @__PURE__ */ jsx(Table.Cell, { children: /* @__PURE__ */ jsx(Text, {
          size: "1",
          style: { fontFamily: "var(--code-font-family)" },
          children: value
        }) })] }, key)) })]
      }) })] })]
    })
  });
}
var LiveLogs = ({ channelID, token, icon }) => {
  const [logs, setLogs] = useState([]);
  const [eventFrequency, setEventFrequency] = useState([]);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`${API_URL}/log/${channelID}`, { headers: { Authorization: token } });
        if (!response.ok) throw new Error("Failed to fetch logs");
        const data = await response.json();
        setLogs(data);
        const eventCounts = {};
        data.forEach((log) => {
          eventCounts[log.event_name] = (eventCounts[log.event_name] || 0) + 1;
        });
        setEventFrequency(Object.entries(eventCounts).map(([name, count]) => ({
          name,
          count
        })));
        const twentyFourHoursAgo = /* @__PURE__ */ new Date((/* @__PURE__ */ new Date()).getTime() - 864e5);
        const hourlyData = {};
        data.forEach((log) => {
          const logTime = new Date(log.timestamp);
          if (logTime >= twentyFourHoursAgo) {
            const hourKey = logTime.toISOString().slice(0, 13) + ":00";
            hourlyData[hourKey] = (hourlyData[hourKey] || 0) + 1;
          }
        });
        setTimeSeriesData(Object.entries(hourlyData).map(([time, count]) => ({
          time: time.slice(11, 16),
          count
        })).sort((a, b) => a.time.localeCompare(b.time)));
      } catch (error) {
        console.error("Error fetching logs:", error);
      }
    };
    fetchLogs();
    const intervalId = setInterval(fetchLogs, 5e3);
    return () => clearInterval(intervalId);
  }, [channelID, token]);
  return /* @__PURE__ */ jsxs(Flex, {
    direction: "column",
    gap: "4",
    children: [
      /* @__PURE__ */ jsxs(Flex, {
        gap: "3",
        children: [/* @__PURE__ */ jsx(Card, {
          size: "2",
          style: { flex: 1 },
          children: /* @__PURE__ */ jsxs(Flex, {
            direction: "column",
            gap: "1",
            children: [/* @__PURE__ */ jsx(Text, {
              size: "2",
              color: "gray",
              children: "Total Events"
            }), /* @__PURE__ */ jsx(Heading, {
              size: "7",
              children: logs.length
            })]
          })
        }), /* @__PURE__ */ jsx(Card, {
          size: "2",
          style: { flex: 1 },
          children: /* @__PURE__ */ jsxs(Flex, {
            direction: "column",
            gap: "1",
            children: [/* @__PURE__ */ jsx(Text, {
              size: "2",
              color: "gray",
              children: "Event Types"
            }), /* @__PURE__ */ jsx(Heading, {
              size: "7",
              children: eventFrequency.length
            })]
          })
        })]
      }),
      /* @__PURE__ */ jsxs(Flex, {
        gap: "4",
        direction: {
          initial: "column",
          md: "row"
        },
        children: [/* @__PURE__ */ jsx(Card, {
          size: "2",
          style: { flex: 2 },
          children: /* @__PURE__ */ jsxs(Flex, {
            direction: "column",
            gap: "3",
            children: [/* @__PURE__ */ jsx(Heading, {
              size: "3",
              children: "Event Frequency (24h)"
            }), timeSeriesData.length > 0 ? /* @__PURE__ */ jsx(ResponsiveContainer, {
              width: "100%",
              height: 220,
              children: /* @__PURE__ */ jsxs(LineChart, {
                data: timeSeriesData,
                children: [
                  /* @__PURE__ */ jsx(CartesianGrid, {
                    strokeDasharray: "3 3",
                    stroke: "var(--gray-a4)"
                  }),
                  /* @__PURE__ */ jsx(XAxis, {
                    dataKey: "time",
                    tick: {
                      fontSize: 11,
                      fill: "var(--gray-9)"
                    },
                    stroke: "var(--gray-a5)"
                  }),
                  /* @__PURE__ */ jsx(YAxis, {
                    tick: {
                      fontSize: 11,
                      fill: "var(--gray-9)"
                    },
                    stroke: "var(--gray-a5)"
                  }),
                  /* @__PURE__ */ jsx(Tooltip, { contentStyle: {
                    background: "var(--gray-2)",
                    border: "1px solid var(--gray-a5)",
                    borderRadius: "8px",
                    fontSize: "12px"
                  } }),
                  /* @__PURE__ */ jsx(Line, {
                    type: "monotone",
                    dataKey: "count",
                    stroke: "#3b82f6",
                    strokeWidth: 2,
                    dot: false,
                    activeDot: { r: 4 }
                  })
                ]
              })
            }) : /* @__PURE__ */ jsx(Flex, {
              align: "center",
              justify: "center",
              style: { height: 220 },
              children: /* @__PURE__ */ jsx(Text, {
                color: "gray",
                size: "2",
                children: "No data yet"
              })
            })]
          })
        }), /* @__PURE__ */ jsx(Card, {
          size: "2",
          style: { flex: 1 },
          children: /* @__PURE__ */ jsxs(Flex, {
            direction: "column",
            gap: "3",
            children: [/* @__PURE__ */ jsx(Heading, {
              size: "3",
              children: "Event Distribution"
            }), eventFrequency.length > 0 ? /* @__PURE__ */ jsx(ResponsiveContainer, {
              width: "100%",
              height: 220,
              children: /* @__PURE__ */ jsxs(PieChart, { children: [/* @__PURE__ */ jsx(Pie, {
                data: eventFrequency,
                cx: "50%",
                cy: "50%",
                outerRadius: 80,
                dataKey: "count",
                label: ({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`,
                labelLine: false,
                style: { fontSize: "11px" },
                children: eventFrequency.map((_entry, index) => /* @__PURE__ */ jsx(Cell, { fill: COLORS[index % COLORS.length] }, `cell-${index}`))
              }), /* @__PURE__ */ jsx(Tooltip, { contentStyle: {
                background: "var(--gray-2)",
                border: "1px solid var(--gray-a5)",
                borderRadius: "8px",
                fontSize: "12px"
              } })] })
            }) : /* @__PURE__ */ jsx(Flex, {
              align: "center",
              justify: "center",
              style: { height: 220 },
              children: /* @__PURE__ */ jsx(Text, {
                color: "gray",
                size: "2",
                children: "No data yet"
              })
            })]
          })
        })]
      }),
      /* @__PURE__ */ jsx(Card, {
        size: "2",
        children: /* @__PURE__ */ jsxs(Flex, {
          direction: "column",
          gap: "3",
          children: [/* @__PURE__ */ jsxs(Flex, {
            align: "center",
            justify: "between",
            children: [/* @__PURE__ */ jsx(Heading, {
              size: "3",
              children: "Recent Events"
            }), /* @__PURE__ */ jsxs(Badge, {
              variant: "soft",
              color: "blue",
              children: [logs.length, " events"]
            })]
          }), /* @__PURE__ */ jsx(ScrollArea, {
            style: { maxHeight: "500px" },
            children: /* @__PURE__ */ jsx(Flex, {
              direction: "column",
              gap: "2",
              children: logs.length === 0 ? /* @__PURE__ */ jsx(Text, {
                color: "gray",
                size: "2",
                style: {
                  padding: "20px 0",
                  textAlign: "center"
                },
                children: "Waiting for events..."
              }) : logs.map((log, idx) => /* @__PURE__ */ jsx(LogCard, {
                log,
                icon,
                idx
              }, `${log.timestamp}-${idx}`))
            })
          })]
        })
      })
    ]
  });
};
function ChannelDetail() {
  const { channel, token } = Route$2.useLoaderData();
  const { companyId } = Route$2.useParams();
  if (!channel) return /* @__PURE__ */ jsx(Text, { children: "Channel not found" });
  return /* @__PURE__ */ jsxs(Flex, {
    direction: "column",
    gap: "5",
    children: [
      /* @__PURE__ */ jsxs(Flex, {
        align: "center",
        justify: "between",
        children: [/* @__PURE__ */ jsxs(Box, { children: [/* @__PURE__ */ jsxs(Flex, {
          align: "center",
          gap: "3",
          mb: "1",
          children: [/* @__PURE__ */ jsx(Text, {
            size: "6",
            children: channel.icon
          }), /* @__PURE__ */ jsx(Heading, {
            size: "6",
            children: channel.name
          })]
        }), /* @__PURE__ */ jsxs(Text, {
          size: "2",
          color: "gray",
          children: ["Channel ID: ", /* @__PURE__ */ jsx(Code, {
            size: "1",
            children: channel.id
          })]
        })] }), /* @__PURE__ */ jsx(Button, {
          variant: "soft",
          size: "2",
          asChild: true,
          children: /* @__PURE__ */ jsx(Link, {
            to: "/dash/$companyId",
            params: { companyId },
            children: "\u2190 Back to channels"
          })
        })]
      }),
      /* @__PURE__ */ jsx(Separator, { size: "4" }),
      /* @__PURE__ */ jsx(LiveLogs, {
        channelID: channel.id,
        token,
        icon: channel.icon
      })
    ]
  });
}

export { ChannelDetail as component };
//# sourceMappingURL=dash._companyId._channelId-OvuYuEkB.mjs.map
