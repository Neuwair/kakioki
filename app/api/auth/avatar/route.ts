import { SharpConfig } from "@/lib/media/SharpConfig";
import { NextResponse } from "next/server";
import { UserRepository } from "@/lib";
import sharp from "sharp";

export async function POST(request: Request) {
  try {
    console.log("Avatar upload started");
    const formData = await request.formData();
    console.log("Form data received");

    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;

    console.log("Form data values:", {
      hasFile: !!file,
      fileType: file?.type,
      fileSize: file?.size,
      userId,
    });

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json(
        { error: "No user ID provided" },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log("File buffer created, size:", buffer.length);

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only images are supported for avatars" },
        { status: 400 },
      );
    }

    try {
      try {
        await sharp({
          create: {
            width: 10,
            height: 10,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 },
          },
        })
          .jpeg()
          .toBuffer();
      } catch (testError) {
        return NextResponse.json(
          {
            error: `Sharp initialization failed: ${
              testError instanceof Error ? testError.message : "Unknown error"
            }`,
          },
          { status: 500 },
        );
      }

      if (!buffer || buffer.length === 0) {
        console.error("Buffer is empty or invalid");
        return NextResponse.json(
          { error: "Empty or invalid image data" },
          { status: 400 },
        );
      }

      console.log("Processing image buffer:", buffer.length, "bytes");

      try {
        const metadata = await sharp(buffer).metadata();
        console.log("Image metadata:", metadata);
      } catch (metadataError) {
        console.error("Failed to read image metadata:", metadataError);
        return NextResponse.json(
          {
            error: `Invalid image data: ${
              metadataError instanceof Error
                ? metadataError.message
                : "Unknown error"
            }`,
          },
          { status: 400 },
        );
      }

      const processed = await SharpConfig.createThumbnail(
        buffer,
        200,
        "webp",
        70,
      );
      console.log("Thumbnail created successfully", {
        width: processed.width,
        height: processed.height,
        format: processed.format,
        size: processed.size,
      });

      const base64 = processed.buffer.toString("base64");
      const avatarUrl = `data:${processed.mime};base64,${base64}`;
      console.log("Base64 URL created, length:", avatarUrl.length);

      const userRepository = new UserRepository();
      const userIdNumber = parseInt(userId, 10);

      if (isNaN(userIdNumber) || userIdNumber <= 0) {
        return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
      }

      console.log("Updating user in database, ID:", userIdNumber);
      const updatedUser = await userRepository.update(userIdNumber, {
        avatar_url: avatarUrl,
      });

      if (!updatedUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      console.log("User updated successfully");
      return NextResponse.json({
        success: true,
        avatarUrl,
        user: {
          id: updatedUser.id,
          userId: (updatedUser as { user_id?: string }).user_id || "",
          email: updatedUser.email,
          username: updatedUser.username,
          avatarUrl: (updatedUser as { avatar_url?: string }).avatar_url,
        },
      });
    } catch (error) {
      console.error("Error in thumbnail creation:", error);
      return NextResponse.json(
        {
          error: `Error processing image: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error in avatar upload route:", error);
    return NextResponse.json(
      {
        error: `Error updating avatar: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 },
    );
  }
}
