"""
Resource Expansion Phase 4 — PDF Document Extraction Source.

Extracts structured content from PDF documents for RAG ingestion:
- Government tax circulars (FINTax)
- Product specification sheets (SmartBuy)
- Medical guidelines (CareMate)
- Research papers and reports (TrendBrief)

Uses PyMuPDF (fitz) for fast extraction with fallback to pdfplumber.

Usage:
    from shared_libs.rag.sources.pdf_extraction import PDFExtractionSource

    extractor = PDFExtractionSource()
    content = extractor.extract_text("path/to/document.pdf")
    structured = extractor.extract_structured("path/to/tax_circular.pdf")
"""

import hashlib
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from pymongo import MongoClient

logger = logging.getLogger("rag.sources.pdf_extraction")

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")


@dataclass
class PDFPage:
    """Represents a single extracted PDF page."""
    page_number: int
    text: str
    tables: list[list[list[str]]] = field(default_factory=list)
    images: list[dict] = field(default_factory=list)


@dataclass
class PDFDocument:
    """Represents a fully extracted PDF document."""
    filename: str
    title: str
    author: str
    pages: list[PDFPage]
    total_pages: int
    full_text: str
    metadata: dict
    file_hash: str
    extracted_at: str


class PDFExtractionSource:
    """
    PDF content extraction for RAG pipeline ingestion.

    Features:
    - Text extraction with layout preservation
    - Table detection and structured extraction
    - Metadata extraction (title, author, creation date)
    - Content deduplication via file hash
    - Chunking for vector store embedding
    """

    # Maximum file size to process (50 MB)
    MAX_FILE_SIZE_MB = 50

    # Chunk size for RAG embedding (characters)
    CHUNK_SIZE = 1000
    CHUNK_OVERLAP = 200

    def __init__(self, mongo_uri: str = MONGODB_URI, db_name: str = "shared_documents"):
        self._client = MongoClient(mongo_uri)
        self._db = self._client[db_name]

    def extract_text(self, file_path: str) -> Optional[PDFDocument]:
        """
        Extract all text content from a PDF file.

        Args:
            file_path: Path to the PDF file.

        Returns:
            PDFDocument with extracted content, or None on failure.
        """
        path = Path(file_path)

        if not path.exists():
            logger.error(f"PDF file not found: {file_path}")
            return None

        if path.stat().st_size > self.MAX_FILE_SIZE_MB * 1024 * 1024:
            logger.error(f"PDF too large: {path.stat().st_size / 1024 / 1024:.1f} MB")
            return None

        # Compute file hash for deduplication
        file_hash = self._compute_file_hash(file_path)

        # Check if already extracted
        cached = self._db.pdf_extractions.find_one({"file_hash": file_hash})
        if cached:
            cached.pop("_id", None)
            logger.info(f"PDF already extracted (cached): {path.name}")
            return PDFDocument(**cached) if isinstance(cached, dict) else None

        # Try PyMuPDF first (faster)
        doc = self._extract_with_pymupdf(file_path, file_hash)

        # Fallback to pdfplumber
        if not doc:
            doc = self._extract_with_pdfplumber(file_path, file_hash)

        if doc:
            # Cache the extraction
            self._cache_extraction(doc)

        return doc

    def extract_structured(self, file_path: str) -> Optional[dict]:
        """
        Extract structured content (headings, sections, tables) from a PDF.

        Useful for government documents, tax circulars, and specifications.

        Args:
            file_path: Path to the PDF file.

        Returns:
            Dict with sections, tables, and metadata.
        """
        doc = self.extract_text(file_path)
        if not doc:
            return None

        # Parse structure from text
        sections = self._parse_sections(doc.full_text)
        tables = []
        for page in doc.pages:
            tables.extend(page.tables)

        return {
            "filename": doc.filename,
            "title": doc.title,
            "author": doc.author,
            "total_pages": doc.total_pages,
            "sections": sections,
            "tables": tables,
            "metadata": doc.metadata,
            "file_hash": doc.file_hash,
        }

    def extract_chunks(self, file_path: str) -> list[dict]:
        """
        Extract and chunk PDF content for RAG vector store embedding.

        Splits text into overlapping chunks suitable for embedding.

        Args:
            file_path: Path to the PDF file.

        Returns:
            List of chunk dicts with text, page_number, chunk_index, metadata.
        """
        doc = self.extract_text(file_path)
        if not doc:
            return []

        chunks = []
        chunk_index = 0

        for page in doc.pages:
            text = page.text.strip()
            if not text:
                continue

            # Split page text into chunks
            page_chunks = self._split_into_chunks(text)

            for chunk_text in page_chunks:
                chunks.append({
                    "id": f"{doc.file_hash}_{chunk_index}",
                    "text": chunk_text,
                    "metadata": {
                        "filename": doc.filename,
                        "title": doc.title,
                        "page_number": page.page_number,
                        "chunk_index": chunk_index,
                        "file_hash": doc.file_hash,
                    },
                })
                chunk_index += 1

        logger.info(f"Extracted {len(chunks)} chunks from {doc.filename}")
        return chunks

    # ─── Extraction Backends ─────────────────────────────────────

    def _extract_with_pymupdf(self, file_path: str, file_hash: str) -> Optional[PDFDocument]:
        """Extract using PyMuPDF (fitz) — fast and reliable."""
        try:
            import fitz  # PyMuPDF

            pdf = fitz.open(file_path)
            pages = []
            full_text_parts = []

            for page_num in range(pdf.page_count):
                page = pdf[page_num]
                text = page.get_text("text")
                pages.append(PDFPage(
                    page_number=page_num + 1,
                    text=text,
                    tables=[],
                    images=[],
                ))
                full_text_parts.append(text)

            metadata = pdf.metadata or {}

            doc = PDFDocument(
                filename=Path(file_path).name,
                title=metadata.get("title", "") or Path(file_path).stem,
                author=metadata.get("author", ""),
                pages=pages,
                total_pages=pdf.page_count,
                full_text="\n\n".join(full_text_parts),
                metadata={
                    "creator": metadata.get("creator", ""),
                    "producer": metadata.get("producer", ""),
                    "creation_date": metadata.get("creationDate", ""),
                    "format": metadata.get("format", ""),
                },
                file_hash=file_hash,
                extracted_at=datetime.now(timezone.utc).isoformat(),
            )

            pdf.close()
            return doc

        except ImportError:
            logger.debug("PyMuPDF not installed, trying pdfplumber")
            return None
        except Exception as e:
            logger.warning(f"PyMuPDF extraction failed: {e}")
            return None

    def _extract_with_pdfplumber(self, file_path: str, file_hash: str) -> Optional[PDFDocument]:
        """Extract using pdfplumber — better table detection."""
        try:
            import pdfplumber

            pages = []
            full_text_parts = []

            with pdfplumber.open(file_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    text = page.extract_text() or ""
                    tables = page.extract_tables() or []

                    # Convert tables to list of lists
                    parsed_tables = []
                    for table in tables:
                        parsed_tables.append([
                            [cell or "" for cell in row]
                            for row in table if row
                        ])

                    pages.append(PDFPage(
                        page_number=page_num + 1,
                        text=text,
                        tables=parsed_tables,
                        images=[],
                    ))
                    full_text_parts.append(text)

                metadata_raw = pdf.metadata or {}

            doc = PDFDocument(
                filename=Path(file_path).name,
                title=metadata_raw.get("Title", "") or Path(file_path).stem,
                author=metadata_raw.get("Author", ""),
                pages=pages,
                total_pages=len(pages),
                full_text="\n\n".join(full_text_parts),
                metadata=metadata_raw,
                file_hash=file_hash,
                extracted_at=datetime.now(timezone.utc).isoformat(),
            )

            return doc

        except ImportError:
            logger.error("Neither PyMuPDF nor pdfplumber installed")
            return None
        except Exception as e:
            logger.error(f"pdfplumber extraction failed: {e}")
            return None

    # ─── Helpers ─────────────────────────────────────────────────

    def _parse_sections(self, text: str) -> list[dict]:
        """Parse document sections from text based on heading patterns."""
        sections = []
        current_section = {"heading": "Introduction", "content": ""}

        # Common heading patterns in Vietnamese government documents
        heading_patterns = [
            r'^(Điều \d+[.:].*)$',           # "Điều 1: ..."
            r'^(Chương [IVX]+[.:].*)$',       # "Chương I: ..."
            r'^(Mục \d+[.:].*)$',             # "Mục 1: ..."
            r'^(\d+\.\s+[A-ZĐÀÁẢÃẠ].*)$',    # "1. Heading..."
            r'^([A-Z][A-ZĐÀÁẢÃẠ\s]{5,})$',   # ALL CAPS headings
        ]

        combined_pattern = "|".join(f"({p})" for p in heading_patterns)

        for line in text.split("\n"):
            line = line.strip()
            if not line:
                continue

            is_heading = bool(re.match(combined_pattern, line, re.MULTILINE))

            if is_heading:
                if current_section["content"].strip():
                    sections.append(current_section)
                current_section = {"heading": line, "content": ""}
            else:
                current_section["content"] += line + "\n"

        # Add last section
        if current_section["content"].strip():
            sections.append(current_section)

        return sections

    def _split_into_chunks(self, text: str) -> list[str]:
        """Split text into overlapping chunks for embedding."""
        chunks = []
        start = 0

        while start < len(text):
            end = start + self.CHUNK_SIZE

            # Try to break at sentence boundary
            if end < len(text):
                # Look for sentence end near chunk boundary
                for sep in [". ", ".\n", "\n\n", "\n"]:
                    last_sep = text.rfind(sep, start + self.CHUNK_SIZE // 2, end + 100)
                    if last_sep > start:
                        end = last_sep + len(sep)
                        break

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            start = end - self.CHUNK_OVERLAP

        return chunks

    @staticmethod
    def _compute_file_hash(file_path: str) -> str:
        """Compute SHA-256 hash of file for deduplication."""
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    def _cache_extraction(self, doc: PDFDocument):
        """Cache extraction result in MongoDB."""
        # Convert dataclass to dict for storage
        doc_dict = {
            "filename": doc.filename,
            "title": doc.title,
            "author": doc.author,
            "total_pages": doc.total_pages,
            "full_text": doc.full_text[:100000],  # Limit stored text
            "metadata": doc.metadata,
            "file_hash": doc.file_hash,
            "extracted_at": doc.extracted_at,
            "page_count": len(doc.pages),
        }

        self._db.pdf_extractions.update_one(
            {"file_hash": doc.file_hash},
            {"$set": doc_dict},
            upsert=True,
        )

    def close(self):
        self._client.close()
