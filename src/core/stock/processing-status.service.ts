import { Injectable } from '@nestjs/common';

/**
 * 處理狀態介面
 */
export interface ProcessingStatus {
  isProcessing: boolean;
  currentBatch: number;
  totalBatches: number;
  progress: number;
  startTime: Date | null;
  message: string;
}

/**
 * 處理狀態服務
 * 負責管理批次處理的狀態信息
 */
@Injectable()
export class ProcessingStatusService {
  // 處理狀態儲存
  private processingStatus: ProcessingStatus = {
    isProcessing: false,
    currentBatch: 0,
    totalBatches: 0,
    progress: 0,
    startTime: null,
    message: '',
  };

  /**
   * 初始化處理狀態
   * @param totalItems 總處理項目數
   * @param batchSize 批次大小
   */
  initializeProcessing(totalItems: number, batchSize: number): void {
    this.processingStatus = {
      isProcessing: true,
      currentBatch: 0,
      totalBatches: Math.ceil(totalItems / batchSize),
      progress: 0,
      startTime: new Date(),
      message: '開始處理股票資料',
    };
  }

  /**
   * 更新當前批次進度
   * @param currentBatch 當前批次號
   * @param message 自定義訊息
   */
  updateBatchProgress(currentBatch: number, message?: string): void {
    this.processingStatus.currentBatch = currentBatch;
    this.processingStatus.progress = Math.round(
      (currentBatch / this.processingStatus.totalBatches) * 100,
    );
    this.processingStatus.message =
      message || `正在處理第 ${currentBatch} 批次`;
  }

  /**
   * 標記處理完成
   * @param message 完成訊息
   */
  markCompleted(message?: string): void {
    this.processingStatus = {
      ...this.processingStatus,
      isProcessing: false,
      currentBatch: this.processingStatus.totalBatches,
      progress: 100,
      message: message || '所有股票歷史資料處理完成',
    };
  }

  /**
   * 標記處理失敗
   * @param error 錯誤信息
   */
  markFailed(error: string): void {
    this.processingStatus = {
      ...this.processingStatus,
      isProcessing: false,
      message: `處理失敗: ${error}`,
    };
  }

  /**
   * 獲取當前處理狀態
   * @returns ProcessingStatus 處理狀態對象
   */
  getStatus(): ProcessingStatus {
    return { ...this.processingStatus };
  }

  /**
   * 獲取格式化的狀態回應
   * @returns 標準化的 API 回應格式
   */
  getStatusResponse() {
    return {
      statusCode: 200,
      message: 'success',
      data: this.getStatus(),
    };
  }

  /**
   * 檢查是否正在處理中
   * @returns boolean 是否正在處理
   */
  isCurrentlyProcessing(): boolean {
    return this.processingStatus.isProcessing;
  }

  /**
   * 重置處理狀態
   */
  reset(): void {
    this.processingStatus = {
      isProcessing: false,
      currentBatch: 0,
      totalBatches: 0,
      progress: 0,
      startTime: null,
      message: '',
    };
  }
}
