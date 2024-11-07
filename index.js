import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

exports.handler = async (event) => {
  const { Octokit } = await import("@octokit/rest").then((module) => module);
  const octokit = new Octokit({ auth: process.env.GIT_TOKEN });

  const s3 = new S3Client({ region: process.env.AWS_REGION });

  try {
    const repositories = await octokit.paginate(
      octokit.rest.repos.listForUser,
      {
        username: process.env.GIT_USER_NAME,
        per_page: 100,
      }
    );

    const allRepoData = [];

    for (const repo of repositories) {
      const repoName = repo.name;
      const owner = repo.owner.login;

      if (repo.size == 0) continue;

      const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
        owner,
        repo: repoName,
        per_page: 100,
      });

      const repoData = {
        _id: repo.id,
        name: repoName,
        html_url: repo.html_url,
        created_at: repo.created_at ?? null,
        updated_at: repo.updated_at ?? null,
        commits: commits.map((commit) => ({
          sha: commit.sha,
          message: commit.commit.message,
          html_url: commit.html_url,
          create_at: commit.commit.author?.date ?? null,
        })),
      };

      allRepoData.push(repoData);
    }

    const params = {
      Bucket: BUCKET_NAME,
      Key: "repos-data.json",
      Body: JSON.stringify(allRepoData, null, 2),
      ContentType: "application/json",
    };

    await s3.send(new PutObjectCommand(params));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "데이터 저장 성공",
      }),
    };
  } catch (error) {
    console.error("데이터를 가져오는 중 오류 발생:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "서버 오류 발생", error: error.message }),
    };
  }
};
