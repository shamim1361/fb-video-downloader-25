import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const videoUrl = searchParams.get("url")
    const filename = searchParams.get("filename") || "facebook-video.mp4"

    if (!videoUrl) {
      return NextResponse.json({ error: "Video URL is required" }, { status: 400 })
    }

    // Fetch the video from Facebook's servers
    const response = await fetch(videoUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept: "video/mp4,video/*,*/*;q=0.9",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "identity",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`)
    }

    // Get the video content
    const videoBuffer = await response.arrayBuffer()

    // Return the video with download headers
    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": videoBuffer.byteLength.toString(),
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    console.error("Proxy download error:", error)
    return NextResponse.json({ error: "Failed to download video" }, { status: 500 })
  }
}
