"use client";
import { Box, Text } from "@radix-ui/themes";
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
} from "recharts";

interface LogItem {
  channel_id: string;
  event_payload: string;
  event_name: string;
  timestamp: string;
}

interface LiveLogsProps {
  channelID: string;
  token: string;
  icon: string;
}

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
            const hourKey = logTime.toISOString().slice(0, 13);
            hourlyData[hourKey] = (hourlyData[hourKey] || 0) + 1;
          }
        });
        setTimeSeriesData(
          Object.entries(hourlyData).map(([time, count]) => ({ time, count }))
        );
      } catch (error) {
        console.error("Error fetching logs:", error);
      }
    };

    fetchLogs();

    const intervalId = setInterval(fetchLogs, 5000);

    return () => clearInterval(intervalId);
  }, [channelID, token]);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  return (
    <div>
      <Text size="1" style={{ color: "grey" }}>
        Count: {logs.length}
      </Text>

      <Box
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <Box style={{ width: "45%" }}>
          <Text size="3">Event Frequency Over Time</Text>
          <LineChart width={400} height={200} data={timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#8884d8" />
          </LineChart>
        </Box>
        <Box style={{ width: "45%" }}>
          <Text size="3">Event Distribution</Text>
          <PieChart width={400} height={200}>
            <Pie
              data={eventFrequency}
              cx={200}
              cy={100}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
            >
              {eventFrequency.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </Box>
      </Box>

      {logs.map((log) => (
        <Box
          key={log.timestamp}
          style={{
            backgroundColor: "#373734",
            borderRadius: "5px",
            padding: "5px",
            margin: "5px",
            width: "300px",
          }}
        >
          <Text size="3">
            {icon} {log.event_name}
          </Text>
          <br />
          <Text size="2">{log.event_payload}</Text>
        </Box>
      ))}
    </div>
  );
};

export default LiveLogs;
