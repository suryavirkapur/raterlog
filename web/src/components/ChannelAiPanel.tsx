import { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Text,
  TextArea,
} from "@radix-ui/themes";
import { api, type AiSummary } from "@/lib/api";

export function ChannelAiPanel({ channelId }: { channelId: string }) {
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [answer, setAnswer] = useState<string>("");
  const [question, setQuestion] = useState("What spiked in the last window?");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function summarize() {
    setBusy(true);
    setError("");
    try {
      setSummary(
        await api<AiSummary>(`/api/channels/${channelId}/ai/summarize`, {
          method: "POST",
          body: "{}",
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summarize failed");
    } finally {
      setBusy(false);
    }
  }

  async function ask() {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ answer: string; summary: AiSummary }>(
        `/api/channels/${channelId}/ai/query`,
        { method: "POST", body: JSON.stringify({ question }) },
      );
      setAnswer(data.answer);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card size="2">
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between">
          <Heading size="4">AI copilot</Heading>
          <Badge variant="soft" color="violet">
            LogSnag-style insights
          </Badge>
        </Flex>
        <Text size="2" color="gray">
          Summarize this channel or ask a question about recent events.
          Heuristics always run; an LLM is used when OPENAI_API_KEY is set on the
          API.
        </Text>
        <Flex gap="2">
          <Button size="2" onClick={summarize} disabled={busy}>
            Summarize events
          </Button>
        </Flex>
        {error && (
          <Text size="2" color="red">
            {error}
          </Text>
        )}
        {summary && (
          <Box>
            <Text size="2">{summary.summary}</Text>
            <Text size="1" color="gray" mt="2" as="div">
              Source: {summary.source}
              {summary.anomalies.length
                ? ` \u00b7 ${summary.anomalies.length} anomal${summary.anomalies.length === 1 ? "y" : "ies"}`
                : ""}
            </Text>
          </Box>
        )}
        <TextArea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about errors, volume, or top events"
        />
        <Button size="2" variant="soft" onClick={ask} disabled={busy}>
          Ask
        </Button>
        {answer && (
          <Text size="2" style={{ whiteSpace: "pre-wrap" }}>
            {answer}
          </Text>
        )}
      </Flex>
    </Card>
  );
}
