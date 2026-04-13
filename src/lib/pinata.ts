const JWT = process.env.NEXT_PUBLIC_PINATA_JWT!

export async function uploadImageToIPFS(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('pinataMetadata', JSON.stringify({ name: file.name }))
  formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${JWT}` },
    body: formData,
  })

  const data = await res.json()
  return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`
}

export async function uploadNFTMetadata(
  name: string,
  description: string,
  imageUrl: string,
  attributes: { trait_type: string; value: string }[]
): Promise<string> {
  const metadata = {
    name,
    description,
    image: imageUrl,
    attributes,
  }

  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${JWT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: `${name}-metadata` },
    }),
  })

  const data = await res.json()
  return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`
}