"use client";
import { Box, Card, Flex, Heading, Text, Badge, ScrollArea, Table, Separator } from "@radix-ui/themes";
import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

interface LogItem {
  channel_id: string;
  event_payload: string;
  event_name: string;
  timestamp: string;
  metadata: string | null;
}

interface LiveLogsProps {
  channelID: string;
  token: string;
  icon: string;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function LogCard({ log, icon, idx }: { log: LogItem; icon: string; idx: number }) {
  const [open, setOpen] = useState(false);

  let parsedMeta: [string, string][] = [];
  if (log.metadata) {
    try {
      const obj = JSON.parse(log.metadata);
      parsedMeta = Object.entries(obj).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)]);
    } catch {
      parsedMeta = [["raw", log.metadata]];
    }
  }

  const hasMeta = parsedMeta.length > 0;

  return (
    <Card
      key={`${log.timestamp}-${idx}`}
      size="2"
      style={{
        background: "var(--gray-a2)",
        cursor: hasMeta ? "pointer" : "default",
        transition: "background 0.15s",
      }}
      onClick={() => hasMeta && setOpen(!open)}
    >
      <Flex direction="column" gap="2">
        <Flex align="center" justify="between">
          <Flex align="center" gap="3">
            <Text size="4">{icon}</Text>
            <Flex direction="column" gap="1">
              <Flex align="center" gap="2">
                <Text weight="bold" size="2">{log.event_name}</Text>
                {hasMeta && (
                  <Badge
                    size="1"
                    variant="soft"
                    color={open ? "blue" : "gray"}
                    style={{ cursor: "pointer" }}
                  >
                    {parsedMeta.length} {parsedMeta.length === 1 ? "field" : "fields"} {open ? "\u25B2" : "\u25BC"}
                  </Badge>
                )}
              </Flex>
              <Text size="1" color="gray">{log.event_payload}</Text>
            </Flex>
          </Flex>
          <Text size="1" color="gray" style={{ whiteSpace: "nowrap" }}>
            {formatTimestamp(log.timestamp)}
          </Text>
        </Flex>

        {open && hasMeta && (
          <>
            <Separator size="4" />
            <Box>
              <Table.Root size="1" variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell style={{ width: "35%" }}>Key</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Value</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {parsedMeta.map(([key, value]) => (
                    <Table.Row key={key}>
                      <Table.Cell>
                        <Text size="1" weight="bold" color="blue">{key}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="1" style={{ fontFamily: "var(--code-font-family)" }}>{value}</Text>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          </>
        )}
      </Flex>
    </Card>
  );
}

const formatTimestamp = (ts: string) => {
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return ts;
  }
};

const LiveLogs: React.FC<LiveLogsProps> = ({ channelID, token, icon }) => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [eventFrequency, setEventFrequency] = useState<
    { name: string; count: number }[]
  >([]);
  const [timeSeriesData, setTimeSeriesData] = useState<
    { time: string; count: number }[]
  >([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`http://localhost:8080/log/${channelID}`, {
          headers: {
            Authorization: token,
          },
        });
        if (!response.ok) {
          throw new Error("Failed to fetch logs");
        }

        const data: LogItem[] = await response.json();
        setLogs(data);

        const eventCounts: { [key: string]: number } = {};
        data.forEach((log) => {
          eventCounts[log.event_name] = (eventCounts[log.event_name] || 0) + 1;
        });
        setEventFrequency(
          Object.entries(eventCounts).map(([name, count]) => ({ name, count }))
        );

        const now = new Date();
        const twentyFourHoursAgo = new Date(
          now.getTime() - 24 * 60 * 60 * 1000
        );
        const hourlyData: { [key: string]: number } = {};
        data.forEach((log) => {
          const logTime = new Date(log.timestamp);
          if (logTime >= twentyFourHoursAgo) {
            const hourKey = logTime.toISOString().slice(0, 13) + ":00";
            hourlyData[hourKey] = (hourlyData[hourKey] || 0) + 1;
          }
        });
        setTimeSeriesData(
          Object.entries(hourlyData)
            .map(([time, count]) => ({ time: time.slice(11, 16), count }))
            .sort((a, b) => a.time.localeCompare(b.time))
        );
      } catch (error) {
        console.error("Error fetching logs:", error);
      }
    };

    fetchLogs();
    const intervalId = setInterval(fetchLogs, 5000);
    return () => clearInterval(intervalId);
  }, [channelID, token]);

  return (
    <Flex direction="column" gap="4">
      {/* Stats */}
      <Flex gap="3">
        <Card size="2" style={{ flex: 1 }}>
          <Flex direction="column" gap="1">
            <Text size="2" color="gray">Total Events</Text>
            <Heading size="7">{logs.length}</Heading>
          </Flex>
        </Card>
        <Card size="2" style={{ flex: 1 }}>
          <Flex direction="column" gap="1">
            <Text size="2" color="gray">Event Types</Text>
            <Heading size="7">{eventFrequency.length}</Heading>
          </Flex>
        </Card>
      </Flex>

      {/* Charts */}
      <Flex gap="4" direction={{ initial: "column", md: "row" }}>
        <Card size="2" style={{ flex: 2 }}>
          <Flex direction="column" gap="3">
            <Heading size="3">Event Frequency (24h)</Heading>
            {timeSeriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-a4)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: "var(--gray-9)" }}
                    stroke="var(--gray-a5)"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--gray-9)" }}
                    stroke="var(--gray-a5)"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--gray-2)",
                      border: "1px solid var(--gray-a5)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Flex align="center" justify="center" style={{ height: 220 }}>
                <Text color="gray" size="2">No data yet</Text>
              </Flex>
            )}
          </Flex>
        </Card>

        <Card size="2" style={{ flex: 1 }}>
          <Flex direction="column" gap="3">
            <Heading size="3">Event Distribution</Heading>
            {eventFrequency.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={eventFrequency}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="count"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                    style={{ fontSize: "11px" }}
                  >
                    {eventFrequency.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--gray-2)",
                      border: "1px solid var(--gray-a5)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Flex align="center" justify="center" style={{ height: 220 }}>
                <Text color="gray" size="2">No data yet</Text>
              </Flex>
            )}
          </Flex>
        </Card>
      </Flex>

      {/* Log Entries */}
      <Card size="2">
        <Flex direction="column" gap="3">
          <Flex align="center" justify="between">
            <Heading size="3">Recent Events</Heading>
            <Badge variant="soft" color="blue">{logs.length} events</Badge>
          </Flex>
          <ScrollArea style={{ maxHeight: "500px" }}>
            <Flex direction="column" gap="2">
              {logs.length === 0 ? (
                <Text color="gray" size="2" style={{ padding: "20px 0", textAlign: "center" }}>
                  Waiting for events...
                </Text>
              ) : (
                logs.map((log, idx) => (
                  <LogCard key={`${log.timestamp}-${idx}`} log={log} icon={icon} idx={idx} />
                ))
              )}
            </Flex>
          </ScrollArea>
        </Flex>
      </Card>
    </Flex>
  );
};

export default LiveLogs;
