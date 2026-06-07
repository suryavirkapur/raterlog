use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

pub async fn send_invite_email(
    smtp_host: &str,
    smtp_port: u16,
    app_url: &str,
    to: &str,
    company_name: &str,
    invite_token: &str,
) -> Result<(), String> {
    if smtp_host.is_empty() {
        tracing::info!("SMTP not configured; skipping invite email to {to}");
        return Ok(());
    }

    let invite_link = format!("{}/invite/{}", app_url.trim_end_matches('/'), invite_token);
    let body = format!(
        "From: Raterlog <noreply@raterlog.dev>\r\n\
         To: {to}\r\n\
         Subject: You've been invited to join {company_name} on Raterlog\r\n\
         MIME-Version: 1.0\r\n\
         Content-Type: text/plain; charset=UTF-8\r\n\
         \r\n\
         You have been invited to join {company_name} on Raterlog.\n\n\
         Accept the invite: {invite_link}\n\n\
         This link expires in 7 days.\n"
    );

    let mut stream = TcpStream::connect((smtp_host, smtp_port))
        .await
        .map_err(|e| e.to_string())?;
    let (reader, mut writer) = stream.split();
    let mut reader = BufReader::new(reader);
    let mut line = String::new();

    async fn expect_code(
        reader: &mut BufReader<tokio::net::tcp::ReadHalf<'_>>,
        line: &mut String,
        code: &str,
    ) -> Result<(), String> {
        line.clear();
        reader.read_line(line).await.map_err(|e| e.to_string())?;
        if line.starts_with(code) {
            Ok(())
        } else {
            Err(format!("unexpected SMTP response: {}", line.trim()))
        }
    }

    async fn write_line(
        writer: &mut tokio::net::tcp::WriteHalf<'_>,
        data: &str,
    ) -> Result<(), String> {
        writer
            .write_all(data.as_bytes())
            .await
            .map_err(|e| e.to_string())
    }

    expect_code(&mut reader, &mut line, "220").await?;
    write_line(&mut writer, "EHLO raterlog\r\n").await?;
    loop {
        line.clear();
        reader.read_line(&mut line).await.map_err(|e| e.to_string())?;
        if line.starts_with("250 ") {
            break;
        }
        if !line.starts_with("250") {
            return Err(format!("unexpected SMTP EHLO response: {}", line.trim()));
        }
    }
    write_line(&mut writer, "MAIL FROM:<noreply@raterlog.dev>\r\n").await?;
    expect_code(&mut reader, &mut line, "250").await?;
    write_line(&mut writer, &format!("RCPT TO:<{to}>\r\n")).await?;
    expect_code(&mut reader, &mut line, "250").await?;
    write_line(&mut writer, "DATA\r\n").await?;
    expect_code(&mut reader, &mut line, "354").await?;
    write_line(&mut writer, &body).await?;
    write_line(&mut writer, "\r\n.\r\n").await?;
    expect_code(&mut reader, &mut line, "250").await?;
    write_line(&mut writer, "QUIT\r\n").await?;
    Ok(())
}
