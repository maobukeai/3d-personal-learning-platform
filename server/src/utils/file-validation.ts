import path from 'path';

/**
 * Minimal, framework-agnostic description of an uploaded file.
 * Both Express (`Express.Multer.File`) and Fastify plain file objects
 * are structurally compatible with this interface.
 */
export interface ValidatableFile {
  fieldname: string;
  originalname: string;
  buffer?: Buffer;
}

const model3dExtensions = [
  '.glb',
  '.gltf',
  '.fbx',
  '.obj',
  '.stl',
  '.dae',
  '.3ds',
  '.blend',
  '.usdz',
  '.abc',
];
const documentExtensions = ['.pdf', '.zip', '.rar', '.7z'];
const imageUploadFields = new Set([
  'logo',
  'favicon',
  'avatar',
  'cover',
  'manual_image',
  'mirror_image',
  'image',
  'images',
  'thumbnail',
  'banner',
  'banner_image',
  'preview',
  'plugin_preview',
  'task_image',
]);

const detectImageMime = (buffer: Buffer): string | null => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
    buffer.subarray(0, 6).toString('ascii') === 'GIF89a'
  ) {
    return 'image/gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.subarray(0, 2).toString('ascii') === 'BM') {
    return 'image/bmp';
  }
  return null;
};

const looksLikeExecutableContent = (buffer: Buffer): boolean => {
  const text = buffer.subarray(0, 4096).toString('utf8').toLowerCase();
  return (
    text.includes('<script') ||
    text.includes('<!doctype html') ||
    text.includes('<html') ||
    text.includes('<?php') ||
    text.startsWith('#!/bin/sh') ||
    text.startsWith('#!/usr/bin/env') ||
    text.startsWith('@echo off')
  );
};

export const validateSingleFileContent = async (file: ValidatableFile) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === 'message_file') {
    // For chat message files, allow all formats, but block PHP files for security
    if (ext === '.php' || ext === '.php5' || ext === '.phtml') {
      throw new Error('安全限制：不允许上传 PHP 脚本文件');
    }
    // Check looksLikeExecutableContent but only if it's HTML or SVG to prevent HTML-based XSS
    if (ext === '.html' || ext === '.htm' || ext === '.svg') {
      if (file.buffer && looksLikeExecutableContent(file.buffer)) {
        throw new Error('安全限制：不允许上传包含脚本的 HTML/SVG 文件');
      }
    }
    return;
  }

  if (
    model3dExtensions.includes(ext) ||
    documentExtensions.includes(ext) ||
    ((file.fieldname === 'plugin_file' || file.fieldname === 'temp') &&
      ['.js', '.ts', '.py', '.lua', '.mjs'].includes(ext))
  ) {
    return;
  }

  if (ext === '.svg') {
    const content = file.buffer ? file.buffer.toString('utf8') : '';
    const hasScript = /<script\b[^>]*>/i.test(content);
    const hasEventHandlers = /\bon[a-z]+\s*=/i.test(content);
    const hasJavascriptUrl = /href\s*=\s*["']\s*javascript:/i.test(content);
    if (hasScript || hasEventHandlers || hasJavascriptUrl) {
      throw new Error('安全验证失败：SVG文件包含潜在的安全隐患');
    }

    if (!content.includes('<svg') && !content.includes('http://www.w3.org/2000/svg')) {
      throw new Error('无效的SVG图片内容');
    }
    return;
  }

  const buffer = file.buffer;
  if (buffer && buffer.length > 0) {
    const imageMime = detectImageMime(buffer);

    if (imageUploadFields.has(file.fieldname)) {
      if (!imageMime) {
        throw new Error('无效的图片文件内容');
      }
    }

    if (looksLikeExecutableContent(buffer)) {
      throw new Error('不允许上传可执行或脚本文件');
    }
  }
};
