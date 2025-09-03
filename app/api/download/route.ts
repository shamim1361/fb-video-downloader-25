import { type NextRequest, NextResponse } from "next/server"
import { isValidFacebookUrl } from "@/lib/utils"
import { getCurrentApiKey, recordSuccess, recordFailure, rotateApiKey } from "@/lib/api-keys"

export interface FacebookMedia {
  url: string
  quality: string
  extension: string
  size: number
  formattedSize: string
  videoAvailable: boolean
  audioAvailable: boolean
  chunked: boolean
  cached: boolean
}

export interface FacebookVideoData {
  url: string
  title: string
  thumbnail: string
  duration: string
  source: string
  medias: FacebookMedia[]
  sid: string | null
}

interface ApiResponse {
  success: boolean
  data?: FacebookVideoData
  error?: string
  keyUsed?: string
}

interface RapidApiResponse {
  status: string
  message: string
  data: {
    video: {
      id: string
      title: string
      description: string | null
      type: string
      duration_ms: number
      thumbnail_url: string
    }
    download: {
      sd: {
        url: string
        quality: string
      }
      hd: {
        url: string
        quality: string
      }
    }
  }
  metadata: {
    process_time_ms: number
    api_version: string
    timestamp: string
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json()
    const { url } = body

    // Validate input
    if (!url || typeof url !== "string") {
      return NextResponse.json({ success: false, error: "URL is required" }, { status: 400 })
    }

    if (!isValidFacebookUrl(url)) {
      return NextResponse.json({ success: false, error: "Invalid Facebook URL format" }, { status: 400 })
    }

    const apiUrl = "https://fdown1.p.rapidapi.com/download"
    let attempts = 0
    const maxAttempts = 4

    while (attempts < maxAttempts) {
      try {
        const apiKey = getCurrentApiKey()

        console.log(`[API] Attempt ${attempts + 1} using new RapidAPI endpoint`)

        const options = {
          method: "POST",
          headers: {
            "x-rapidapi-key": apiKey,
            "x-rapidapi-host": "fdown1.p.rapidapi.com",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url }),
        }

        const response = await fetch(apiUrl, options)

        if (response.ok) {
          const result: RapidApiResponse = await response.json()

          if (result.status !== "success" || !result.data?.video) {
            throw new Error("Invalid response format from RapidAPI")
          }

          const transformedData: FacebookVideoData = {
            url: url,
            title: result.data.video.title || "Untitled",
            thumbnail: result.data.video.thumbnail_url || "",
            duration: result.data.video.duration_ms
              ? `${Math.round(result.data.video.duration_ms / 1000)}s`
              : "Unknown",
            source: "Facebook",
            medias: [
              // HD quality option
              {
                url: result.data.download.hd.url,
                quality: "HD",
                extension: "mp4",
                size: 0, // Size not provided by new API
                formattedSize: "Unknown",
                videoAvailable: true,
                audioAvailable: true,
                chunked: false,
                cached: false,
              },
              // SD quality option
              {
                url: result.data.download.sd.url,
                quality: "SD",
                extension: "mp4",
                size: 0,
                formattedSize: "Unknown",
                videoAvailable: true,
                audioAvailable: true,
                chunked: false,
                cached: false,
              },
            ],
            sid: result.data.video.id,
          }

          console.log(`[API] Success with new RapidAPI endpoint`)
          recordSuccess()

          return NextResponse.json({
            success: true,
            data: transformedData,
            keyUsed: "RapidAPI fdown1",
          })
        } else if (response.status === 429) {
          console.log(`[API] Rate limit hit, retrying...`)
          recordFailure()
          rotateApiKey()
          attempts++
          await new Promise((resolve) => setTimeout(resolve, 1000))
          continue
        } else if (response.status === 403) {
          console.log(`[API] Forbidden, retrying...`)
          recordFailure()
          rotateApiKey()
          attempts++
          continue
        } else {
          const errorText = await response.text()
          throw new Error(`API request failed with status: ${response.status} - ${errorText}`)
        }
      } catch (error) {
        console.error(`[API] Error:`, error)
        recordFailure()
        attempts++

        if (attempts >= maxAttempts) {
          return NextResponse.json(
            {
              success: false,
              error: "RapidAPI failed. Please try again later.",
            },
            { status: 503 },
          )
        }

        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to download video after all attempts",
      },
      { status: 503 },
    )
  } catch (error) {
    console.error("[API] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    )
  }
}
